import { savedOAuthTokens } from "./oauth-model.js";
import {
  buildQueryStringFromParams,
  joinUrlAndQueryString,
  smartEncodeUrl,
} from "./template-url.js";
/** Resolve original request metadata/field references without changing resources.
 * @param {Record<string, any>[]} resources
 * @param {string} requestId
 * @param {(text: string, field: string) => Promise<string>} render
 * @param {any[]} args
 * @param {(url: string, name: string) => Promise<any>} [readCookie]
 */
export async function requestTemplateTag(
  resources,
  requestId,
  render,
  args,
  readCookie,
) {
  const [attribute, name, folderIndex] = args;
  const request = resources.find((resource) => resource._id === requestId);
  if (!request) throw new Error("Request not found for " + requestId);

  if (attribute === "url" || attribute === "cookie") {
    if (attribute === "cookie" && !name) throw new Error("No cookie specified");
    const params = [];
    for (let index = 0; index < (request.parameters || []).length; index++) {
      const parameter = request.parameters[index];
      params.push({
        name: await render(
          String(parameter.name ?? ""),
          "parameter:" + index + ":name",
        ),
        value: await render(
          String(parameter.value ?? ""),
          "parameter:" + index + ":value",
        ),
      });
    }
    const url = smartEncodeUrl(
      joinUrlAndQueryString(
        await render(String(request.url || ""), "url"),
        buildQueryStringFromParams(params),
      ),
      request.settingEncodeUrl,
    );
    if (attribute === "url") return url;
    if (!readCookie)
      throw new Error("Request cookie references require the desktop app");
    return readCookie(url, name);
  }
  if (attribute === "name") return request.name;
  if (attribute === "folder") {
    const ancestors = [];
    const visited = new Set([requestId]);
    let parentId = request.parentId;
    while (parentId) {
      if (visited.has(parentId))
        throw new Error("Cyclic request folder ancestry");
      visited.add(parentId);
      const parent = resources.find((resource) => resource._id === parentId);
      if (!parent) break;
      if (["request_group", "workspace"].includes(parent._type))
        ancestors.push(parent);
      parentId = parent.parentId;
    }
    const index = folderIndex || 0;
    const folder = ancestors[index];
    if (!folder) throw new Error("Could not get folder by index " + index);
    return folder.name;
  }
  if (attribute === "header" || attribute === "parameter") {
    if (!name || typeof name !== "string")
      throw new Error(
        attribute === "header"
          ? "No header specified"
          : "No query parameter specified",
      );
    const rows =
      (attribute === "header" ? request.headers : request.parameters) || [];
    if (!rows.length)
      throw new Error(
        attribute === "header"
          ? "No headers available"
          : "No query parameters available",
      );
    const names = [];
    // Legacy references include disabled rows; sending filters them separately.
    for (let index = 0; index < rows.length; index++) {
      const renderedName = await render(
        String(rows[index].name || ""),
        attribute + ":" + index + ":name",
      );
      names.push(renderedName);
      if (renderedName.toLowerCase() === name.toLowerCase())
        return render(
          String(rows[index].value || ""),
          attribute + ":" + index + ":value",
        );
    }
    throw new Error(
      "No " +
        attribute +
        " with name " +
        JSON.stringify(name) +
        ". Choices: " +
        names.map((value) => JSON.stringify(value)).join(", "),
    );
  }
  if (["oauth2", "oauth2-identity", "oauth2-refresh"].includes(attribute)) {
    // An explicit saved-value reference, matching the original tag. It does not
    // fetch/refresh a token or select the credential used by Authorization.
    const token = savedOAuthTokens({ resources }, requestId)[0];
    if (!token || !token.accessToken)
      throw new Error("No OAuth 2.0 access tokens found for request");
    const field =
      attribute === "oauth2"
        ? "accessToken"
        : attribute === "oauth2-identity"
          ? "identityToken"
          : "refreshToken";
    const value = token[field];
    if (value != null && typeof value !== "string")
      throw new Error("Saved OAuth template value must be text");
    return value;
  }
  return null;
}
