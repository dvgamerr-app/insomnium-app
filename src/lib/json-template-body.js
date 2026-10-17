import { builtinTemplateNames } from "./template-registration.js";

/** Render interpolations and registered output tags inside valid JSON strings.
 * Preserve every other source token, including large integers and escaped braces.
 * Blocks/comments and non-JSON bodies retain the existing whole-text renderer.
 * @param {string} source @param {(text:string)=>Promise<string>} render
 * @param {string[]} [registeredTagNames] */
export async function renderJsonTemplateBody(source, render, registeredTagNames = []) {
  if (source.includes("{#")) return render(source);
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
    if (!token.includes("{{") && !token.includes("{%")) { start = end; continue; }
    const decoded = JSON.parse('"' + token + '"');
    const offsets = [0];
    for (let index = 0; index < token.length;) {
      index += token[index] === "\\" ? (token[index + 1] === "u" ? 6 : 2) : 1;
      offsets.push(index);
    }
    for (let index = 0; index < decoded.length - 1; index++) {
      const opening = decoded.slice(index,index + 2);
      if (!["{{", "{%"].includes(opening) || token.slice(offsets[index],offsets[index] + 2) !== opening) continue;
      const closing = opening === "{{" ? "}}" : "%}";
      if (opening === "{%") {
        const name = /^\{%-?\s*([^\s,%}]+)/.exec(decoded.slice(index))?.[1];
        // Unregistered syntax, including control blocks, keeps whole-template semantics.
        if (!name || (!builtinTemplateNames.includes(name) && !registeredTagNames.includes(name))) return render(source);
      }
      let quote = "", finish = index + 2, regex = false, regexClass = false, depth = 0;
      for (; finish < decoded.length - 1; finish++) {
        const char = decoded[finish];
        if (regex) {
          if (char === "\\") finish++;
          else if (char === "[") regexClass = true;
          else if (char === "]") regexClass = false;
          else if (char === "/" && !regexClass) regex = false;
        } else if (quote) {
          if (char === "\\") finish++;
          else if (char === quote) quote = "";
        } else if (char === "'" || char === '"') quote = char;
        else if (char === "r" && decoded[finish + 1] === "/" && !/[\w$]/.test(decoded[finish - 1])) {
          regex = true; regexClass = false; finish++;
        } else if (["(", "[", "{"].includes(char)) depth++;
        else if (depth && ")]}".includes(char)) depth--;
        else if (depth === 0 && decoded.slice(finish,finish + 2) === closing) break;
      }
      if (finish >= decoded.length - 1) return render(source);
      if (changes.length >= 1000) throw new Error("JSON body exceeds 1000 template interpolations");
      let left = index, right = finish + 2;
      if (decoded[index + 2] === "-")
        while (left > 0 && /\s/.test(decoded[left - 1])) left--;
      if (decoded[finish - 1] === "-")
        while (right < decoded.length && /\s/.test(decoded[right])) right++;
      changes.push({
        start:Math.max(start + 1 + offsets[left], changes.at(-1)?.end ?? 0),
        end:start + 1 + offsets[right],text:decoded.slice(index,finish + 2),
      });
      index = right - 1;
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
