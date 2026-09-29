import { requestEnvironmentLayers } from "./template-environment.js";
import { createRequestRenderSession } from "./template-session.js";

/** Preview orchestration never prompts or sends dependent requests.
 * @param {string} text @param {Record<string,any>} context
 * @param {{requestId:string, workspaceId?:string, resources:Record<string,any>[], history?:Record<string,any>[], environmentId?:string|null, signal:AbortSignal}} options
 */
export async function renderRequestPreview(text, context, options) {
  const session = createRequestRenderSession(context, {
    ...options,
    purpose: "preview",
    environmentLayers: requestEnvironmentLayers(
      options.resources,
      options.requestId,
      options.environmentId,
    ) ?? [{ data: context }],
  });
  try {
    return await session.render(text);
  } finally {
    session.dispose();
  }
}
