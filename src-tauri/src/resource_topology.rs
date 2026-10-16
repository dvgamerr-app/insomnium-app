//! Shared navigable-resource rules for persisted workspaces and Git recovery.
use serde_json::Value;
use std::collections::{HashMap, HashSet};

pub(crate) fn owner<'a>(records: &HashMap<&'a str, &'a Value>, id: &str) -> Option<&'a str> {
    let mut item = *records.get(id)?;
    let mut seen = HashSet::new();
    loop {
        let id = item["_id"].as_str()?;
        if !seen.insert(id) {
            return None;
        }
        if item["_type"] == "workspace" {
            return Some(id);
        }
        item = *records.get(item["parentId"].as_str()?)?;
    }
}

pub(crate) fn validate(records: &HashMap<&str, &Value>) -> Result<(), String> {
    for resource in records.values() {
        let mut seen = HashSet::new();
        let mut current = *resource;
        loop {
            let id = current["_id"]
                .as_str()
                .ok_or("Invalid topology resource ID")?;
            if !seen.insert(id) {
                return Err("Circular workspace parent reference".into());
            }
            let Some(parent) = current["parentId"].as_str().and_then(|id| records.get(id)) else {
                break;
            };
            current = parent;
        }
        let allowed: &[&str] = match resource["_type"].as_str().unwrap_or("") {
            "environment" => &["workspace", "environment"],
            "request_group" | "request" | "grpc_request" | "websocket_request" => {
                &["workspace", "request_group"]
            }
            _ => continue, // Unknown legacy resource models remain intact.
        };
        let parent = resource["parentId"].as_str().and_then(|id| records.get(id));
        if parent.is_none_or(|parent| !allowed.contains(&parent["_type"].as_str().unwrap_or("")))
            || owner(records, resource["_id"].as_str().unwrap_or("")).is_none()
        {
            return Err("Invalid or missing parent for navigable workspace resource".into());
        }
    }
    Ok(())
}
