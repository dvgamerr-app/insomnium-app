import { invoke, isTauri } from "@tauri-apps/api/core";

/** @typedef {{kind:"anonymous"}|{kind:"basic",username:string,password:string}|{kind:"github"|"gitlab",token:string}} RemoteCredentials */
/** @typedef {{url:string,credentials?:RemoteCredentials}} RemoteInput */
/** @typedef {{url:string,branches:{name:string,reference:string,oid:string}[],defaultBranch:string|null,headOid:string|null,empty:boolean}} Advertisement */

/** @param {string} command @param {Record<string,any>} args */
async function nativeCall(command, args) {
  if (!isTauri())
    throw new Error("Git remotes require the desktop application.");
  return invoke(command, args);
}

/** @param {RemoteInput} input */
function snapshot(input) {
  // Copy plain fields so caller changes cannot alter an in-flight request.
  const value = JSON.parse(JSON.stringify(input));
  if (!value || typeof value.url !== "string")
    throw new Error("Git remote URL is required.");
  let url;
  try {
    url = new URL(value.url);
  } catch {
    throw new Error("Invalid Git remote URL.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new Error(
      "Use an HTTP(S) Git endpoint with credentials entered separately.",
    );
  value.url = url.href;
  value.credentials ||= { kind: "anonymous" };
  return /** @type {RemoteInput} */ (value);
}

/** @param {any} result @param {string} url @returns {Advertisement} */
function checkedResult(result, url) {
  if (
    !result ||
    result.url !== url ||
    !Array.isArray(result.branches) ||
    result.branches.length > 10000 ||
    typeof result.empty !== "boolean" ||
    !(
      result.defaultBranch === null || typeof result.defaultBranch === "string"
    ) ||
    !(result.headOid === null || /^[0-9a-f]{40}$/.test(result.headOid))
  )
    throw new Error("Invalid Git remote response.");
  const names = new Set();
  for (const branch of result.branches) {
    if (
      !branch ||
      typeof branch.name !== "string" ||
      !branch.name ||
      branch.reference !== "refs/heads/" + branch.name ||
      typeof branch.oid !== "string" ||
      !/^[0-9a-f]{40}$/.test(branch.oid) ||
      names.has(branch.name)
    )
      throw new Error("Invalid Git remote branch response.");
    names.add(branch.name);
  }
  if (result.empty && (result.branches.length || result.headOid !== null))
    throw new Error("Inconsistent Git remote response.");
  return result;
}

/** @param {string} url */
async function endpointKeyFor(url) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(url),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
/** Exact branch names only; null/undefined means all branches.
 * @param {unknown} value @returns {string|null} */
export function normalizeFetchBranch(value) {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "string" ||
    !value ||
    new TextEncoder().encode("refs/heads/" + value).length > 4096 ||
    /[\x00-\x20\x7f~^:?*\[\\]/.test(value) ||
    value.includes("..") ||
    value.includes("@{") ||
    value.endsWith(".") ||
    value
      .split("/")
      .some((part) => !part || part.startsWith(".") || part.endsWith(".lock"))
  )
    throw new Error("Invalid selected fetch branch.");
  return value;
}

/** @param {unknown} value @returns {number|null} */
export function normalizeFetchDepth(value) {
  if (value === null || value === undefined) return null;
  if (
    !Number.isInteger(value) ||
    typeof value !== "number" ||
    value <= 0 ||
    value >= 2147483647
  )
    throw new Error("Invalid fetch history depth.");
  return value;
}

/** @param {any} manifest */
function snapshotBranch(manifest) {
  if (manifest?.version === 3)
    return normalizeFetchBranch(manifest.selectedBranch);
  if (manifest?.version === 1 && manifest.selectedBranch == null) return null;
  if (manifest?.version === 2 && typeof manifest.selectedBranch === "string")
    return normalizeFetchBranch(manifest.selectedBranch);
  throw new Error("Invalid Git fetch snapshot scope.");
}

/** @param {any} value @param {string} url @param {string} endpointKey */
function checkedFetchSnapshot(value, url, endpointKey) {
  const manifest = value?.manifest;
  const selectedBranch = snapshotBranch(manifest);
  if (
    typeof value?.oid !== "string" ||
    !/^[0-9a-f]{40}$/.test(value.oid) ||
    manifest?.endpointKey !== endpointKey ||
    typeof manifest?.operationId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      manifest.operationId,
    )
  )
    throw new Error("Invalid Git fetch snapshot receipt.");
  checkedResult(
    {
      url,
      branches: manifest.branches,
      defaultBranch: manifest.defaultBranch,
      headOid: null,
      empty: false,
    },
    url,
  );
  if (
    selectedBranch !== null &&
    !manifest.branches.some(
      /** @param {any} branch */ (branch) => branch.name === selectedBranch,
    )
  )
    throw new Error("Selected branch is missing from Git fetch snapshot.");
  const depth = normalizeFetchDepth(manifest.requestedDepth);
  if (manifest.version !== 3) {
    if (depth !== null || manifest.histories != null)
      throw new Error("Legacy fetch receipt cannot contain history metadata.");
  } else {
    const histories = manifest.histories;
    if (
      !Array.isArray(histories) ||
      histories.length !== manifest.branches.length
    )
      throw new Error("Missing per-branch fetch histories.");
    const names = new Set(
      manifest.branches.map(/** @param {any} b */ (b) => b.name),
    );
    const seen = new Set();
    let total = 0;
    for (const history of histories) {
      if (
        !history ||
        !names.has(history.name) ||
        seen.has(history.name) ||
        !Array.isArray(history.boundaries)
      )
        throw new Error("Invalid per-branch fetch history.");
      seen.add(history.name);
      const historyDepth = normalizeFetchDepth(history.depth);
      if (
        !Object.hasOwn(history, "depth") ||
        (historyDepth === null && history.boundaries.length) ||
        history.boundaries.length > 10000 ||
        ((selectedBranch === null || selectedBranch === history.name) &&
          historyDepth !== depth)
      )
        throw new Error("Inconsistent per-branch fetch history.");
      total += history.boundaries.length;
      if (total > 100000) throw new Error("Fetch histories exceed size limit.");
      let previous = "";
      for (const boundary of history.boundaries) {
        if (
          typeof boundary !== "string" ||
          !/^[0-9a-f]{40}$/.test(boundary) ||
          /^0+$/.test(boundary) ||
          boundary <= previous
        )
          throw new Error("Invalid fetch history boundary.");
        previous = boundary;
      }
    }
  }
  return value;
}

/** Read-only requests remain pending until the original native command settles.
 * A cancel acknowledgement is not completion of the native worker.
 * @param {{call?:(command:string,args:Record<string,any>)=>Promise<any>,requestId?:()=>string}} [options] */
export function createGitRemoteClient({
  call = nativeCall,
  requestId = () => crypto.randomUUID(),
} = {}) {
  /** Fetch publishes a native snapshot. A successful commit stays successful
   * even when cancellation or a view change races with its reply.
   * @param {{requestId?:string,workspaceId:string,repositoryId:string,branch?:string|null,depth?:number|null,expectedBinding:Record<string,any>}} input
   * @param {{signal:AbortSignal,current:()=>boolean}} scope */
  async function submitFetch(input, scope, recovery = false) {
    const active = () => !scope.signal.aborted && scope.current();
    if (!active()) throw new Error("Git fetch is no longer current.");
    const captured = JSON.parse(JSON.stringify(input));
    captured.branch = normalizeFetchBranch(captured.branch);
    const depth = normalizeFetchDepth(captured.depth);
    delete captured.depth;
    const remote = snapshot({ url: captured.expectedBinding?.uri });
    if (!captured.workspaceId || !captured.repositoryId)
      throw new Error("Git fetch requires a collection and repository.");
    if (recovery && !captured.requestId)
      throw new Error("Recovery requires the saved operation ID.");
    const id = captured.requestId || requestId();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
    )
      throw new Error("Invalid fetch operation ID.");
    // Operation identity survives restart; cancellation belongs to one attempt.
    const attemptId = recovery ? requestId() : id;
    if (
      typeof attemptId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        attemptId,
      ) ||
      (recovery && attemptId === id)
    )
      throw new Error("Recovery requires a fresh attempt ID.");
    let submitted = false;
    let cancelled = false;
    const cancel = () => {
      if (!submitted || cancelled) return;
      cancelled = true;
      void Promise.resolve()
        .then(() => call("git_remote_cancel", { requestId: attemptId }))
        .catch(() => {});
    };
    scope.signal.addEventListener("abort", cancel, { once: true });
    try {
      const endpointKey = await endpointKeyFor(remote.url);
      if (!active()) throw new Error("Git fetch is no longer current.");
      submitted = true;
      const fetchRequest = {
        ...captured,
        requestId: id,
        ...(recovery ? {} : { depth }),
      };
      const result = await call(
        recovery ? "git_remote_fetch_recover" : "git_remote_fetch",
        {
          request: recovery
            ? { fetch: fetchRequest, depth, attemptId }
            : fetchRequest,
        },
      );
      const manifest = result?.snapshot?.manifest;
      if (
        !/^[0-9a-f]{40}$/.test(result?.snapshot?.oid || "") ||
        snapshotBranch(manifest) !== captured.branch ||
        normalizeFetchDepth(manifest?.requestedDepth) !== depth ||
        manifest?.operationId !== id ||
        manifest?.endpointKey !== endpointKey ||
        typeof result?.reconciled !== "boolean" ||
        !(
          result.cleanupPending === null ||
          typeof result.cleanupPending === "boolean"
        )
      )
        throw new Error(
          "Invalid Git fetch receipt. The snapshot may already be committed.",
        );
      checkedFetchSnapshot(result.snapshot, remote.url, endpointKey);
      return { ...result, requestId: id, current: active() };
    } catch (error) {
      // Keep the operation ID for reconciliation; rejection is not proof that
      // native publication did not happen (for example a lost IPC reply).
      throw Object.assign(
        new Error(error instanceof Error ? error.message : String(error)),
        { requestId: id, submitted },
      );
    } finally {
      scope.signal.removeEventListener("abort", cancel);
    }
  }
  return {
    fetch: submitFetch,
    /** @param {Parameters<typeof submitFetch>[0]} input @param {Parameters<typeof submitFetch>[1]} scope */
    recoverFetch(input, scope) {
      return submitFetch(input, scope, true);
    },
    /** Metadata only: pending does not establish candidate graph recoverability.
     * @param {{requestId:string,workspaceId:string,repositoryId:string,branch?:string|null,depth?:number|null,expectedBinding:Record<string,any>}} input
     * @param {{signal:AbortSignal,current:()=>boolean}} scope */
    async recoveryStatus(input, scope) {
      const active = () => !scope.signal.aborted && scope.current();
      if (!active())
        throw new Error("Fetch recovery inspection is no longer current.");
      const captured = JSON.parse(JSON.stringify(input));
      captured.branch = normalizeFetchBranch(captured.branch);
      if (
        typeof captured.requestId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          captured.requestId,
        )
      )
        throw new Error("Invalid fetch operation ID.");
      const result = await call("git_remote_fetch_recovery_status", {
        request: captured,
      });
      if (!active())
        throw new Error("Fetch recovery inspection is no longer current.");
      if (result === null) return null;
      if (
        result?.operationId !== captured.requestId ||
        typeof result.targetSnapshot !== "string" ||
        !/^[0-9a-f]{40}$/.test(result.targetSnapshot) ||
        /^0+$/.test(result.targetSnapshot) ||
        !["before snapshot publication", "after snapshot publication"].includes(
          result.state,
        )
      )
        throw new Error("Invalid fetch recovery status response.");
      return result;
    },
    /** Observe an existing operation without repeating it. A false result means
     * unconfirmed, not rolled back or never committed.
     * @param {{requestId:string,workspaceId:string,repositoryId:string,branch?:string|null,depth?:number|null,expectedBinding:Record<string,any>}} input
     * @param {{signal:AbortSignal,current:()=>boolean}} scope */
    async inspectFetch(input, scope) {
      const active = () => !scope.signal.aborted && scope.current();
      if (!active())
        throw new Error("Git fetch inspection is no longer current.");
      const captured = JSON.parse(JSON.stringify(input));
      captured.branch = normalizeFetchBranch(captured.branch);
      const depth = normalizeFetchDepth(captured.depth);
      if (depth !== null) captured.depth = depth;
      const remote = snapshot({ url: captured.expectedBinding?.uri });
      if (
        typeof captured.requestId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          captured.requestId,
        )
      )
        throw new Error("Invalid fetch operation ID.");
      const endpointKey = await endpointKeyFor(remote.url);
      if (!active())
        throw new Error("Git fetch inspection is no longer current.");
      // Read-only IPC has no remote worker to cancel. Keep awaiting completion
      // so the workspace caller can drain this work before switching storage.
      const result = await call("git_remote_fetch_inspect", {
        request: captured,
      });
      if (!active())
        throw new Error("Git fetch inspection is no longer current.");
      if (
        result?.requestId !== captured.requestId ||
        typeof result?.confirmedCurrent !== "boolean" ||
        !(result.snapshot === null || result.snapshot)
      )
        throw new Error("Invalid Git fetch inspection response.");
      if (result.snapshot !== null)
        checkedFetchSnapshot(result.snapshot, remote.url, endpointKey);
      const matches =
        result.snapshot !== null &&
        result.snapshot.manifest.operationId === captured.requestId &&
        snapshotBranch(result.snapshot.manifest) === captured.branch &&
        normalizeFetchDepth(result.snapshot.manifest.requestedDepth) === depth;
      if (result.confirmedCurrent !== matches)
        throw new Error("Inconsistent Git fetch inspection response.");
      return result;
    },
    /** @param {RemoteInput} input
     * @param {{signal:AbortSignal,current:()=>boolean}} scope */
    async advertise(input, scope) {
      const active = () => !scope.signal.aborted && scope.current();
      if (!active())
        throw new Error("Git remote request is no longer current.");
      const captured = snapshot(input);
      const id = requestId();
      let submitted = false;
      let cancelled = false;
      const cancel = () => {
        if (!submitted || cancelled) return;
        cancelled = true;
        // Failure cannot make an aborted request current again. The native
        // supervisor's own deadline still bounds a request if cancel IPC fails.
        void Promise.resolve()
          .then(() => call("git_remote_cancel", { requestId: id }))
          .catch(() => {});
      };
      scope.signal.addEventListener("abort", cancel, { once: true });
      try {
        if (!active())
          throw new Error("Git remote request is no longer current.");
        submitted = true;
        const result = await call("git_remote_advertise", {
          requestId: id,
          input: captured,
        });
        if (!active())
          throw new Error("Git remote request is no longer current.");
        return checkedResult(result, captured.url);
      } finally {
        scope.signal.removeEventListener("abort", cancel);
      }
    },
  };
}
