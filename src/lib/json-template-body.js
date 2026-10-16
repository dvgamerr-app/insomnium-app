/** Render interpolations in valid JSON strings using their decoded expressions.
 * Preserve every other source token, including large integers and escaped braces.
 * Blocks/comments and non-JSON bodies retain the existing whole-text renderer.
 * @param {string} source @param {(text:string)=>Promise<string>} render */
export async function renderJsonTemplateBody(source, render) {
  if (source.includes("{%") || source.includes("{#")) return render(source);
  try { JSON.parse(source); } catch { return render(source); }
  /** @type {{start:number,end:number,text:string}[]} */ const changes = [];
  for (let start = 0; start < source.length; start++) {
    if (source[start] !== '"') continue;
    let end = start + 1;
    for (; end < source.length; end++) {
      if (source[end] === "\\") end++;
      else if (source[end] === '"') break;
    }
    const token = source.slice(start + 1,end);
    if (!token.includes("{{")) { start = end; continue; }
    const decoded = JSON.parse('"' + token + '"');
    const offsets = [0];
    for (let index = 0; index < token.length;) {
      index += token[index] === "\\" ? (token[index + 1] === "u" ? 6 : 2) : 1;
      offsets.push(index);
    }
    for (let index = 0; index < decoded.length - 1; index++) {
      if (decoded.slice(index,index + 2) !== "{{" || token.slice(offsets[index],offsets[index] + 2) !== "{{") continue;
      let quote = "", finish = index + 2;
      for (; finish < decoded.length - 1; finish++) {
        const char = decoded[finish];
        if (quote) {
          if (char === "\\") finish++;
          else if (char === quote) quote = "";
        } else if (char === "'" || char === '"') quote = char;
        else if (decoded.slice(finish,finish + 2) === "}}") break;
      }
      if (finish >= decoded.length - 1) return render(source);
      if (changes.length >= 1000) throw new Error("JSON body exceeds 1000 template interpolations");
      changes.push({start:start + 1 + offsets[index],end:start + 1 + offsets[finish + 2],text:decoded.slice(index,finish + 2)});
      index = finish + 1;
    }
    start = end;
  }
  let output = "", previous = 0;
  for (const change of changes) {
    const rendered = JSON.stringify(await render(change.text)).slice(1,-1);
    if (output.length + change.start - previous + rendered.length > 20 * 1024 * 1024)
      throw new Error("Rendered JSON body exceeds 20 Mi characters");
    output += source.slice(previous,change.start) + rendered;
    previous = change.end;
  }
  if (output.length + source.length - previous > 20 * 1024 * 1024)
    throw new Error("Rendered JSON body exceeds 20 Mi characters");
  return output + source.slice(previous);
}
