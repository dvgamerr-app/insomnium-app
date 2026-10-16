/** Render a decoded GraphQL envelope, including independently encoded variables.
 * JSON variables are data: a variable named `disabled` must not disable rendering.
 * @param {ReturnType<import('./template-session.js').createRequestRenderSession>} session
 * @param {Record<string,any>} body
 */
export async function renderGraphqlTemplateBody(session, body) {
  const input = { ...body };
  const hasVariables = Object.hasOwn(input, "variables");
  const variables = input.variables;
  delete input.variables;
  const rendered = JSON.parse(await session.renderValue(JSON.stringify(input), {
    path: "body.text", jsonPaths: ["body.text"],
  }));
  if (hasVariables) {
    const text = await session.renderValue(
      typeof variables === "string" ? variables : JSON.stringify(variables),
      { path: "body.variables", jsonPaths: ["body.variables"] },
    );
    rendered.variables = typeof variables === "string" ? text : JSON.parse(text);
  }
  return rendered;
}
