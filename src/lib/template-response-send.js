import {
  latestTemplateResponse,
  readTemplateResponse,
  validateResponseReference,
} from "./template-response.js";
import { TemplateLimitError } from "./template-object.js";

/** Match archived trigger coercion, including unknown modes behaving like never.
 * @param {Record<string,any>|undefined} response @param {any} behavior @param {any} maxAgeSeconds @param {number} [now]
 */
export function shouldResendResponse(
  response,
  behavior,
  maxAgeSeconds,
  now = Date.now(),
) {
  const mode = behavior || "never";
  if (typeof mode !== "string")
    throw new Error("Invalid response trigger behavior");
  switch (mode.toLowerCase()) {
    case "always":
      return true;
    case "no-history":
      return !response;
    case "when-expired":
      return !response || (now - response.created) / 1000 > maxAgeSeconds;
    default:
      return false;
  }
}

/** One root render's response history and bounded dependent-send adapter.
 * Root calls omit requestChain; child calls forward the SAME array they receive.
 * This intentionally does not globally memoize always or coalesce simultaneous calls.
 * @param {Record<string,any>[]} resources @param {Record<string,any>[]} history
 * @param {string|null|undefined} environmentId
 * @param {(request:Record<string,any>,requestChain:string[],signal:AbortSignal)=>Promise<Record<string,any>>} sendDependency
 * @param {(request:Record<string,any>)=>string|null|undefined} [dependencyEnvironment]
 */
export function createResponseTemplateResolver(
  resources,
  history,
  environmentId,
  sendDependency,
  dependencyEnvironment = () => environmentId,
) {
  const snapshot = structuredClone({ resources, history, environmentId });
  /** @type {Map<string,{response:Record<string,any>,size:number}>} */
  const received = new Map();
  let retained = 0;
  let sends = 0;
  /** @param {any[]} args @param {AbortSignal} signal @param {string[]} [requestChain] @param {string|null|undefined} [callerEnvironmentId] */
  return async function resolveResponse(
    args,
    signal,
    requestChain = [],
    callerEnvironmentId = snapshot.environmentId,
  ) {
    signal.throwIfAborted();
    validateResponseReference(snapshot.resources, args);
    const id = args[1];
    const historyKey = JSON.stringify([id, callerEnvironmentId || null]);
    let response =
      received.get(historyKey)?.response ||
      latestTemplateResponse(snapshot.history, id, callerEnvironmentId);
    if (
      !Array.isArray(requestChain) ||
      requestChain.length > 32 ||
      requestChain.some((id) => typeof id !== "string")
    )
      throw new TemplateLimitError("Invalid dependent request chain");
    if (
      shouldResendResponse(response, args[3], args[4]) &&
      !requestChain.includes(id)
    ) {
      if (++sends > 32 || requestChain.length >= 32)
        throw new TemplateLimitError("Dependent request send limit exceeded");
      requestChain.push(id);
      const request = snapshot.resources.find(
        (resource) => resource._id === id && resource._type === "request",
      );
      if (!request) throw new Error("Could not find dependent request");
      const targetEnvironmentId = dependencyEnvironment(request) || null;
      const result = await sendDependency(
        structuredClone(request),
        requestChain,
        signal,
      );
      signal.throwIfAborted();
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw new Error("Dependent request returned no response");
      if (
        (result.requestId != null && result.requestId !== id) ||
        (Object.hasOwn(result, "environmentId") &&
          (result.environmentId || null) !== targetEnvironmentId)
      )
        throw new Error(
          "Dependent response does not match its request/environment",
        );
      response = structuredClone({
        ...result,
        requestId: id,
        environmentId: targetEnvironmentId,
      });
      const responseKey = JSON.stringify([id, targetEnvironmentId]);
      const size = JSON.stringify(response).length;
      const nextSize = retained - (received.get(responseKey)?.size || 0) + size;
      if (nextSize > 40 * 1024 * 1024)
        throw new TemplateLimitError(
          "Dependent response history exceeds 40 Mi characters",
        );
      retained = nextSize;
      received.set(responseKey, { response, size });
    }
    signal.throwIfAborted();
    return readTemplateResponse(response, args, signal);
  };
}
