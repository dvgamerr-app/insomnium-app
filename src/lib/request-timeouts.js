const MAX = 3600000;

/** Blank means the existing global policy; zero explicitly disables a timeout.
 * @param {unknown} value @param {string} label */
function milliseconds(value, label) {
  if (value == null || value === "") return null;
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !/^\d+$/.test(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 0 ||
    Number(value) > MAX
  )
    throw new Error(`${label} must be a whole number from 0 to 3,600,000 ms.`);
  return Number(value);
}

/** @param {Record<string,any>} request */
export function requestTimeouts(request) {
  return {
    requestTimeoutMs: milliseconds(
      request.settingRequestTimeout,
      "Request timeout",
    ),
    connectTimeoutMs: milliseconds(
      request.settingConnectTimeout,
      "Connection timeout",
    ),
  };
}

/** curl decimal seconds are truncated to milliseconds, as in libcurl.
 * @param {string|undefined} value @param {number} fallback */
export function curlTimeout(value, fallback) {
  if (value === undefined) return fallback;
  if (!/^\d+(?:\.\d*)?$|^\.\d+$/.test(value))
    throw new Error("cURL timeout requires nonnegative decimal seconds.");
  const [whole, fraction = ""] = value.split(".");
  const integer = whole.replace(/^0+/, "") || "0";
  if (integer.length > 4)
    throw new Error("cURL timeout exceeds 3,600 seconds.");
  const number =
    BigInt(integer) * 1000n + BigInt((fraction + "000").slice(0, 3));
  if (number > BigInt(MAX))
    throw new Error("cURL timeout exceeds 3,600 seconds.");
  return Number(number);
}
