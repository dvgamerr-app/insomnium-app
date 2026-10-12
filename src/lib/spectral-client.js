import { invoke, isTauri } from "@tauri-apps/api/core";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const messages = {
  binding: "The collection's repository changed. Validate again.",
  cancelled: "Specification validation was cancelled.",
  capacity: "Other specifications are being validated. Try again shortly.",
  expired: "Specification validation expired. Validate again.",
  input_limit: "The specification or its references exceed the validation limits.",
  output_limit: "Specification diagnostics exceed the validation limit.",
  owner: "The collection is no longer available for validation.",
  protocol: "The specification validator returned an invalid response.",
  timeout: "Specification validation exceeded 15 seconds. Reduce its size and retry.",
  unsupported: "Specification linting requires the desktop application.",
  process: "Specification validation failed. Try again.",
};
/** @param {unknown} reason */
function failure(reason) {
  const code = typeof reason === "string" && Object.hasOwn(messages, reason)
    ? reason : "process";
  return new Error(messages[/** @type {keyof typeof messages} */ (code)]);
}
function aborted() {
  return new DOMException(messages.cancelled, "AbortError");
}
/** Native commands own reservations and physically reap before settling RUN/CANCEL.
 * The result promise remains pending through cancellation; callers must await it
 * before releasing their workspace work. No source is logged or staged here.
 * @param {{call?:(command:string,args:Record<string,any>)=>Promise<any>,available?:()=>boolean}} [options] */
export function createSpectralClient({ call = invoke, available = isTauri } = {}) {
  return {
    available,
    /** @param {{workspaceId:string,specId:string,sourceJson:string,repositoryId:string|null,expectedBinding:Record<string,any>|null}} input
     * @param {AbortSignal} [signal] */
    start(input, signal) {
      // Capture the registered binding before any await; caller owns source/workspace guards.
      const captured = JSON.parse(JSON.stringify(input));
      let cancelled = signal?.aborted === true;
      let settled = false;
      let accepted = false;
      let jobId = "";
      /** @type {Promise<void>|undefined} */
      let cancellation;
      function requestCancel() {
        if (!jobId || cancellation || settled) return;
        cancellation = Promise.resolve()
          .then(() => call("cancel_spectral_lint", { jobId }))
          .then((reply) => {
            if (reply?.jobId !== jobId || typeof reply.cancelled !== "boolean")
              throw failure("protocol");
          })
          .catch((error) => {
            if (error instanceof Error && Object.values(messages).includes(error.message))
              throw error;
            throw failure(error);
          });
        // Abort listeners cannot return an awaited promise. Keep its error owned
        // until the result's finally block awaits the same operation.
        void cancellation.catch(() => {});
      }
      function abort() {
        cancelled = true;
        requestCancel();
      }
      signal?.addEventListener("abort", abort, { once: true });
      const result = (async () => {
        try {
          if (cancelled) throw aborted();
          if (!available()) throw failure("unsupported");
          const reservation = await call("reserve_spectral_lint", { input: captured });
          if (typeof reservation?.jobId !== "string" || !uuid.test(reservation.jobId))
            throw failure("protocol");
          jobId = reservation.jobId;
          if (cancelled) {
            requestCancel();
            throw aborted();
          }
          const reply = await call("run_spectral_lint", { jobId });
          if (cancelled) throw aborted();
          if (reply?.jobId !== jobId || typeof reply.resultJson !== "string" ||
              new TextEncoder().encode(reply.resultJson).byteLength > 8 * 1024 * 1024)
            throw failure("protocol");
          let parsed;
          try { parsed = JSON.parse(reply.resultJson); } catch { throw failure("protocol"); }
          if (!parsed || !Array.isArray(parsed.diagnostics) || !Array.isArray(parsed.sources) ||
              !["default", "custom"].includes(parsed.selectedRuleset) || typeof parsed.fallback !== "boolean")
            throw failure("protocol");
          accepted = true;
          return { ...parsed, jobId };
        } catch (error) {
          if (cancelled) throw aborted();
          if (error instanceof Error && Object.values(messages).includes(error.message)) throw error;
          throw failure(error);
        } finally {
          // RUN may refuse admission (for example its two-worker limit). Retire
          // the reservation on every failure, not only on an explicit abort.
          if (jobId && !accepted) requestCancel();
          // RUN settlement proves process cleanup even if CANCEL IPC rejects.
          // A cancellation during reserve retires the known pending reservation.
          try { if (cancellation) await cancellation; }
          finally {
            settled = true;
            signal?.removeEventListener("abort", abort);
          }
        }
      })();
      return {
        result,
        /** Physical settlement precedes resolution, including reserve-in-flight. */
        cancel() {
          abort();
          return result.then(() => {}, () => {});
        },
      };
    },
  };
}

export const spectralClient = createSpectralClient();
