/** @typedef {import("./git-remote-client.js").RemoteInput} RemoteInput */
/** Legacy Git input forms are displayed as their normalized HTTPS endpoint.
 * @param {string} value */
export function normalizeGitRemoteUrl(value) {
  let text = value.trim().replace(/^git\+/, "");
  const hosted = /^(github|gitlab|bitbucket):([^?#\s]+)$/.exec(text);
  if (hosted)
    text =
      "https://" +
      {
        github: "github.com",
        gitlab: "gitlab.com",
        bitbucket: "bitbucket.org",
      }[hosted[1]] +
      "/" +
      hosted[2];
  else if (/^[\w.-]+\/[\w.-]+$/.test(text)) text = "https://github.com/" + text;
  text = text.replace(/^git@([^:/]+):/, "https://$1/");
  let url;
  try {
    url = new URL(text);
    if (url.protocol === "ssh:")
      url = new URL("https://" + url.host + url.pathname + url.search);
  } catch {
    throw new Error("Enter a valid Git repository URL.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hash ||
    /[\x00-\x1f\x7f]/.test(text) ||
    new TextEncoder().encode(url.href).length > 8192
  )
    throw new Error(
      "Use an HTTP(S) repository URL and enter credentials separately.",
    );
  return url.href;
}

/** @param {RemoteInput} input @returns {RemoteInput} */
export function validateGitRemoteSettings(input) {
  const url = normalizeGitRemoteUrl(input.url);
  const credentials = input.credentials || { kind: "anonymous" };
  if (!["anonymous", "basic", "github", "gitlab"].includes(credentials.kind))
    throw new Error("Choose a supported Git authentication method.");
  if (credentials.kind === "anonymous")
    return { url, credentials: { kind: "anonymous" } };
  const valid = (/** @type {string} */ v) =>
    typeof v === "string" &&
    !!v &&
    new TextEncoder().encode(v).length <= 16384 &&
    !/[\x00-\x1f\x7f]/.test(v);
  if (credentials.kind === "basic") {
    if (
      !valid(credentials.username) ||
      credentials.username.includes(":") ||
      !valid(credentials.password)
    )
      throw new Error("Enter a valid Git username and password/token.");
    return {
      url,
      credentials: {
        kind: "basic",
        username: credentials.username,
        password: credentials.password,
      },
    };
  }
  if (!valid(credentials.token)) throw new Error("Enter a valid Git token.");
  return {
    url,
    credentials: { kind: credentials.kind, token: credentials.token },
  };
}

/** @param {Record<string,any>} binding @returns {RemoteInput} */
export function readGitRemoteSettings(binding) {
  const c = binding.credentials;
  if (!c) return { url: binding.uri || "", credentials: { kind: "anonymous" } };
  if (c.oauth2format === "github" || c.oauth2format === "gitlab")
    return {
      url: binding.uri || "",
      credentials: { kind: c.oauth2format, token: c.token || "" },
    };
  return {
    url: binding.uri || "",
    credentials: {
      kind: "basic",
      username: c.username || "",
      password: c.password || c.token || "",
    },
  };
}

/** @param {RemoteInput} input */
export function gitRemoteSettingsPatch(input) {
  const checked = validateGitRemoteSettings(input),
    c = checked.credentials;
  const credentials =
    c?.kind === "anonymous"
      ? null
      : c?.kind === "basic"
        ? { username: c.username, password: c.password }
        : {
            oauth2format: c?.kind,
            username: "",
            token: c && "token" in c ? c.token : "",
          };
  return { uri: checked.url, credentials };
}
