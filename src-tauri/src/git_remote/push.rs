//! Native-only transport for a leased, immutable outgoing repository.
//! No renderer command accepts this protocol or its filesystem path.
use super::{
    authentication_callbacks, endpoint, history_view_while, remote_error, RemoteAdvertisementInput,
};
use git2::{Direction, ErrorCode, Oid, PushOptions, Repository};
use serde::{Deserialize, Serialize};
use std::{cell::RefCell, path::PathBuf};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PushWorkerInput {
    pub(crate) directory: PathBuf,
    pub(crate) remote: RemoteAdvertisementInput,
    pub(crate) operation_id: String,
    pub(crate) source_branch: String,
    pub(crate) source_oid: String,
    pub(crate) destination_branch: String,
    pub(crate) expected_remote_oid: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct PushWorkerResult {
    pub(crate) operation_id: String,
    pub(crate) source_oid: String,
    pub(crate) destination_branch: String,
    pub(crate) outcome: Outcome,
    /// Observation on the receive-pack connection before upload, not a final
    /// remote result. The supervisor must perform a separate later inspection.
    pub(crate) advertised_remote_oid: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum Outcome {
    Unchanged,
    Accepted,
    Rejected,
    NonFastForward,
    Stale,
    Unknown,
}

fn oid(value: &str) -> Result<Oid, String> {
    if value.len() != 40
        || !value
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
    {
        return Err("Push requires a full lowercase commit ID.".into());
    }
    let oid = Oid::from_str(value).map_err(remote_error)?;
    if oid.is_zero() {
        return Err("Push cannot delete a remote branch.".into());
    }
    Ok(oid)
}

#[derive(Default)]
struct Report {
    negotiated: bool,
    stale: bool,
    invalid: bool,
    callbacks: usize,
    rejected: bool,
}

/// Caller must hold the exact native staging lease through this function.
/// Any transport error after negotiation is unknown, never an implicit retry.
pub(crate) fn push(
    input: PushWorkerInput,
    stage: &crate::git_remote_job::StageReservation,
) -> Result<PushWorkerResult, String> {
    if uuid::Uuid::parse_str(&input.operation_id)
        .map(|id| id.to_string())
        .ok()
        .as_deref()
        != Some(&input.operation_id)
    {
        return Err("Invalid Push operation identity.".into());
    }
    let url = endpoint(&input.remote.url)?;
    stage.verify_outgoing(&input.operation_id)?;
    let source = crate::git::branch_reference(&input.source_branch)?;
    let destination = crate::git::branch_reference(&input.destination_branch)?;
    let tip = oid(&input.source_oid)?;
    let expected = input.expected_remote_oid.as_deref().map(oid).transpose()?;
    if stage.repository_path()? != input.directory {
        return Err("Outgoing Push lease does not match its snapshot.".into());
    }
    // Validate plain bounded ODB files and reject alternates before opening
    // any repository config. Graph verification reads this isolated ODB only.
    let objects = stage.object_repository(|| Ok(()))?;
    history_view_while(&objects, tip, &[], || Ok(()))?;
    let repository = Repository::open_bare(&input.directory).map_err(remote_error)?;
    repository
        .set_config(&git2::Config::new().map_err(remote_error)?)
        .map_err(remote_error)?;
    if repository
        .find_reference(&source)
        .map_err(remote_error)?
        .target()
        != Some(tip)
    {
        return Err("Outgoing Push snapshot changed.".into());
    }
    // Missing ancestry/objects cannot silently turn into an incomplete upload.
    // Stage preparation must copy the entire selected graph, with no alternates.
    let mut remote = repository
        .remote_anonymous(url.as_str())
        .map_err(remote_error)?;
    let advertised = {
        let callbacks = authentication_callbacks(&url, &input.remote.credentials)?;
        let connection = remote
            .connect_auth(Direction::Push, Some(callbacks), None)
            .map_err(remote_error)?;
        let heads = connection.list().map_err(remote_error)?;
        if heads.len() > 10000 {
            return Err("Remote advertises too many references.".into());
        }
        let matching = heads
            .iter()
            .filter(|head| head.name() == destination)
            .collect::<Vec<_>>();
        if matching.len() > 1 {
            return Err("Duplicate remote Push destination.".into());
        }
        matching
            .first()
            .map(|head| head.oid())
            .filter(|oid| !oid.is_zero())
    };
    let result = |outcome| PushWorkerResult {
        operation_id: input.operation_id.clone(),
        source_oid: tip.to_string(),
        destination_branch: input.destination_branch.clone(),
        outcome,
        advertised_remote_oid: advertised.map(|oid| oid.to_string()),
    };
    if advertised != expected {
        return Ok(result(Outcome::Stale));
    }
    if advertised == Some(tip) {
        return Ok(result(Outcome::Unchanged));
    }

    let report = RefCell::new(Report::default());
    let mut callbacks = authentication_callbacks(&url, &input.remote.credentials)?;
    callbacks.push_negotiation(|updates| {
        let mut report = report.borrow_mut();
        if updates.len() != 1
            || updates[0].src_refname_bytes() != source.as_bytes()
            || updates[0].dst_refname_bytes() != destination.as_bytes()
            || updates[0].dst() != tip
        {
            report.invalid = true;
            return Err(git2::Error::from_str("Unexpected Push negotiation."));
        }
        // git2 PushUpdate::src is the OLD remote OID; dst is the NEW OID.
        // Check the actual negotiated advertisement again before any upload.
        if updates[0].src() != expected.unwrap_or(Oid::ZERO_SHA1) {
            report.stale = true;
            return Err(git2::Error::from_str("Remote Push destination changed."));
        }
        report.negotiated = true;
        Ok(())
    });
    callbacks.push_update_reference(|name, status| {
        let mut report = report.borrow_mut();
        report.callbacks += 1;
        if name != destination || report.callbacks != 1 {
            report.invalid = true;
        }
        // Never echo untrusted server messages (may contain credentials/URLs).
        report.rejected |= status.is_some();
        Ok(())
    });
    let transported = {
        let mut options = PushOptions::new();
        options.remote_callbacks(callbacks);
        options.follow_redirects(git2::RemoteRedirect::None);
        // Exactly one heads-to-heads refspec. No '+', deletion or wildcard.
        remote.push(&[format!("{source}:{destination}")], Some(&mut options))
    };
    let report = report.into_inner();
    let outcome = if report.stale && !report.negotiated {
        Outcome::Stale
    } else if report.invalid {
        Outcome::Unknown
    } else if report.callbacks == 0
        && transported
            .as_ref()
            .is_err_and(|error| error.code() == ErrorCode::NotFastForward)
    {
        // libgit2 1.9.7 queue_objects refuses this before transport->push,
        // even though negotiation may already have completed. Keep other
        // transport failures unknown; do not classify by server message text.
        Outcome::NonFastForward
    } else if report.negotiated && report.callbacks == 1 && report.rejected {
        Outcome::Rejected
    } else if transported.is_ok() && report.negotiated && report.callbacks == 1 {
        Outcome::Accepted
    } else {
        Outcome::Unknown
    };
    Ok(result(outcome))
}
