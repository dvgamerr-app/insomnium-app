/** Build lanes from real commit parent OIDs, including merge edges and continuing history.
 * @param {{oid:string,parentOids:string[]}[]} commits */
export function graphRows(commits) {
  /** @type {string[]} */
  let lanes = [];
  return commits.map((commit) => {
    const incoming = [...lanes];
    let column = lanes.indexOf(commit.oid);
    if (column < 0) {
      column = lanes.length;
      lanes.push(commit.oid);
    }
    const before = [...lanes];
    lanes.splice(column, 1);
    for (const [index, parent] of commit.parentOids.entries()) {
      if (!lanes.includes(parent))
        lanes.splice(Math.min(column + index, lanes.length), 0, parent);
    }
    const x = (/** @type {number} */ index) => 10 + index * 14;
    const paths = incoming.map((oid, index) =>
      oid === commit.oid
        ? `M${x(index)} 0 L${x(column)} 22`
        : `M${x(index)} 0 L${x(index)} 12 L${x(lanes.indexOf(oid))} 32 L${x(lanes.indexOf(oid))} 44`,
    );
    for (const parent of commit.parentOids)
      paths.push(
        `M${x(column)} 22 L${x(lanes.indexOf(parent))} 36 L${x(lanes.indexOf(parent))} 44`,
      );
    return {
      x: x(column),
      width: Math.max(24, Math.max(before.length, lanes.length) * 14 + 6),
      paths,
    };
  });
}
