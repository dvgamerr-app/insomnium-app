/** Preserve legacy request-tree order and folder prefixes without mutating the
 * collection snapshot. Unreachable/cyclic requests are not valid tree entries.
 * @param {Record<string,any>[]} resources @param {unknown} model
 * @returns {{value:string,label:string}[]} */
export function templateModelOptions(resources, model) {
  if (typeof model !== "string") return [];
  const type = model.toLowerCase();
  if (type !== "request")
    return resources
      .filter((item) => item._type?.toLowerCase() === type)
      .map((item) => ({
        value: item._id,
        label: typeof item.name === "string" ? item.name : "Unknown Request",
      }));
  /** @type {Map<string|undefined,Record<string,any>[]>} */ const children =
    new Map();
  for (const item of resources) {
    if (!["request", "request_group"].includes(item._type)) continue;
    const siblings = children.get(item.parentId) ?? [];
    siblings.push(item);
    children.set(item.parentId, siblings);
  }
  for (const siblings of children.values())
    siblings.sort((a, b) =>
      a.metaSortKey === b.metaSortKey
        ? a._id > b._id
          ? -1
          : 1
        : a.metaSortKey < b.metaSortKey
          ? -1
          : 1,
    );
  const roots = resources.filter((item) => item._type === "workspace");
  /** @type {{item:Record<string,any>,prefix:string}[]} */ const pending = [];
  for (const root of roots.length ? roots : [{ _id: undefined }])
    for (const item of [...(children.get(root._id) ?? [])].reverse())
      pending.push({ item, prefix: "" });
  const seen = new Set();
  /** @type {{value:string,label:string}[]} */ const options = [];
  while (pending.length) {
    const next = pending.pop();
    if (!next || seen.has(next.item._id)) continue;
    const { item, prefix } = next;
    seen.add(item._id);
    if (item._type === "request")
      options.push({
        value: item._id,
        label: `${prefix}${typeof item.method === "string" ? item.method : "GET"} ${typeof item.name === "string" ? item.name : "Unknown Request"}`,
      });
    else {
      const folderPrefix = `${prefix}[${typeof item.name === "string" ? item.name : ""}] `;
      for (const child of [...(children.get(item._id) ?? [])].reverse())
        pending.push({ item: child, prefix: folderPrefix });
    }
  }
  return options;
}
