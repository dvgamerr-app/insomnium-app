import { diffLines } from "diff";

/** Build one read-only document while retaining the source line numbers.
 * Source text is never parsed, reformatted, or written back to Git.
 * @param {string|null} before
 * @param {string|null} after
 */
export function unifiedDiff(before, after) {
  const oldText = before ?? "";
  const newText = after ?? "";
  const diff = diffLines(oldText, newText, {
    timeout: 150,
    maxEditLength: 10000,
  });
  const parts = diff ?? [
    { value: oldText, removed: true, added: false },
    { value: newText, added: true, removed: false },
  ];
  let oldLine = 1,
    newLine = 1,
    added = 0,
    removed = 0;
  /** @type {string[]} */
  const lines = [];
  /** @type {{line:number,className:string,gutterText:string,gutterLabel:string}[]} */
  const decorations = [];
  for (const part of parts) {
    if (!part.value) continue;
    const values = part.value.split("\n");
    if (values.at(-1) === "") values.pop();
    for (const text of values) {
      const previous = part.added ? "" : String(oldLine++);
      const current = part.removed ? "" : String(newLine++);
      const kind = part.added ? "added" : part.removed ? "deleted" : "context";
      const marker = part.added ? "+" : part.removed ? "−" : " ";
      decorations.push({
        line: lines.length,
        className: `diff-line-${kind}`,
        gutterText: `${previous.padStart(5)} ${current.padStart(5)} ${marker}`,
        gutterLabel: `${kind}; before ${previous || "absent"}; after ${current || "absent"}`,
      });
      lines.push(text.replace(/\r$/, ""));
      if (part.added) added++;
      if (part.removed) removed++;
    }
  }
  return {
    value: lines.join("\n"),
    decorations,
    added,
    removed,
    replacement: !diff,
    beforeNoNewline: !!oldText && !oldText.endsWith("\n"),
    afterNoNewline: !!newText && !newText.endsWith("\n"),
  };
}
