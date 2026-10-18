/** Parse transport addresses without changing the saved request URL.
 * @param {string} raw */
export function grpcEndpoint(raw) {
  const secure = /^grpcs:\/\//i.test(raw);
  let address = raw.replace(/^grpcs?:\/\//i, "");
  if (/^unix:/i.test(address)) {
    // The archived parseGrpcUrl lowercases the complete transport address.
    const parsed = /^(?:\/\/([^/]*)\/)?(.+)$/.exec(
      address.slice(5).toLowerCase(),
    );
    if (!parsed) throw new Error("Enter a gRPC socket path.");
    const path = (parsed[1] === "" ? "/" : "") + parsed[2];
    if (path.includes("\0"))
      throw new Error("A gRPC socket path cannot contain NUL.");
    return {
      url: new URL(`${secure ? "https" : "http"}://localhost/`),
      target: `${secure ? "grpcs://" : ""}unix:${path.startsWith("//") ? "//" : ""}${path}`,
    };
  }
  const dns = /^dns:/i.test(address);
  if (dns) {
    let path = address.slice(4);
    if (path.startsWith("//")) {
      const slash = path.indexOf("/", 2);
      if (slash < 0) throw new Error("Invalid gRPC DNS target.");
      if (slash > 2)
        throw new Error("Custom gRPC DNS servers are not supported yet.");
      path = path.slice(slash + 1);
    }
    if (!path || /[/?#@\\]/.test(path))
      throw new Error(
        "Enter a gRPC DNS host and port without a path or credentials.",
      );
    const tail = path.startsWith("[")
      ? path.slice(path.indexOf("]") + 1)
      : path.split(":").length === 2
        ? path.slice(path.indexOf(":"))
        : "";
    if (tail && !/^:[0-9]+$/.test(tail))
      throw new Error("Invalid gRPC DNS target port.");
    address = path;
  }
  const ip = dns ? null : /^(ipv[46]):(?:\/\/[^/]*\/)?(.+)$/i.exec(address);
  if (!dns && /^ipv[46]:/i.test(address) && !ip)
    throw new Error("Invalid gRPC IP target.");
  if (ip) {
    const family = ip[1].toLowerCase();
    const entries = ip[2].split(",");
    if (entries.length > 256)
      throw new Error("gRPC targets exceed 256 addresses.");
    const urls = entries.map((entry) => {
      const bracket = /^\[([^\]]+)\](?::([0-9]+))?$/.exec(entry);
      const parts = entry.split(":");
      const host = bracket ? bracket[1] : parts.length === 2 ? parts[0] : entry;
      const port = bracket
        ? bracket[2]
        : parts.length === 2
          ? parts[1]
          : undefined;
      if (
        (port !== undefined && !/^[0-9]+$/.test(port)) ||
        (port !== undefined && Number(port) > 65535)
      )
        throw new Error("Invalid gRPC IP target port.");
      const ipv4 = host.split(".");
      if (
        family === "ipv4" &&
        (bracket ||
          ipv4.length !== 4 ||
          ipv4.some(
            (part) => !/^(0|[1-9][0-9]{0,2})$/.test(part) || Number(part) > 255,
          ))
      )
        throw new Error("An ipv4 target requires IPv4 addresses.");
      if (family === "ipv6" && !host.includes(":"))
        throw new Error("An ipv6 target requires IPv6 addresses.");
      const authority = family === "ipv6" ? `[${host}]` : host;
      return new URL(
        `${secure ? "https" : "http"}://${authority}:${port ?? 443}/`,
      );
    });
    const target = urls
      .map((url) => `${url.hostname}:${url.port || (secure ? 443 : 80)}`)
      .join(",");
    return {
      url: urls[0],
      target: `${secure ? "grpcs://" : ""}${family}:${target}`,
    };
  }
  const grpcStyle = dns || !raw.includes("://") || /^grpcs?:\/\//i.test(raw);
  // Bare IPv6 has no port in grpc-js; brackets are required to specify a port.
  const host =
    grpcStyle &&
    !address.startsWith("[") &&
    address.split(":").length > 2 &&
    !/[/?#@]/.test(address)
      ? `[${address}]`
      : address;
  const normalized =
    dns || /^grpcs?:\/\//i.test(raw) || !raw.includes("://")
      ? `${secure ? "https" : "http"}://${host}`
      : raw;
  const url = new URL(normalized);
  if (grpcStyle) {
    // A non-special scheme retains explicit :80 before HTTP URL normalization.
    const probe = new URL(`grpc://${host}`);
    if (!probe.port) url.port = "443";
  }
  return { url, target: url.toString() };
}
