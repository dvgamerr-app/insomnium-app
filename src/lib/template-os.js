import { JSONPath } from "jsonpath-plus";

import { osFunctions } from "./template-os-functions.js";

/** Format native OS values in the disposable template worker.
 * Preserve the original first-match query and invalid-query fallback.
 * @param {any} value @param {any[]} args @returns {string | undefined}
 */
export function formatOsTemplateValue(value, [name, filter]) {
  if (!osFunctions.includes(name))
    throw new Error("Unknown OS template function");
  // Reconstruct legacy property order after serde_json/native IPC serialization.
  if (name === "userInfo") {
    const { uid, gid, username, homedir, shell } = value;
    value = { uid, gid, username, homedir, shell };
  } else if (name === "cpus") {
    value = value.map(
      (
        /** @type {{model:string, speed:number, times:Record<string,number>}} */ {
          model,
          speed,
          times,
        },
      ) => ({
        model,
        speed,
        times: {
          user: times.user,
          nice: times.nice,
          sys: times.sys,
          idle: times.idle,
          irq: times.irq,
        },
      }),
    );
  }
  if (name === "userInfo" || name === "cpus") {
    if (filter != null && (typeof filter !== "string" || filter.length > 4096))
      throw new Error("OS JSONPath query must be at most 4096 characters");
    let count = 0;
    let size = 0;
    const limitError = new Error("OS JSONPath result limit exceeded");
    try {
      const results = JSONPath({
        json: value,
        path: filter,
        eval: "safe",
        wrap: true,
        callback(item) {
          size += JSON.stringify(item)?.length || 4;
          if (++count > 10000 || size > 20 * 1024 * 1024) throw limitError;
        },
      });
      if (Array.isArray(results)) value = results[0];
    } catch (error) {
      if (error === limitError) throw error;
      // Archived OS tags ignore invalid filters and serialize the original value.
    }
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}
