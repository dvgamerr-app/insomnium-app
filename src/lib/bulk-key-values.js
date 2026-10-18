import {templateEditorRange} from "./template-authoring.js";

/** Legacy name: value lines with lossless JSON tuples for literal whitespace,
 * colons in names, line breaks, empty rows and non-string imported values.
 * @param {Record<string,any>} row */
export function bulkKeyValueLine(row) {
  const name = row.name === undefined ? "" : row.name, value = row.value === undefined ? "" : row.value, disabled = Boolean(row.disabled);
  if (typeof name !== "string" || typeof value !== "string" || !name && !value ||
      name !== name.trim() || value !== value.trim() || /[:\r\n]/.test(name) || /[\r\n]/.test(value) ||
      name.startsWith("# ") || name.startsWith("[") || row.noValue === true)
    return JSON.stringify([name,value,disabled,row.noValue === true]);
  return (disabled ? "# " : "") + name + ": " + value;
}
/** @param {Record<string,any>[]} rows */
export function formatBulkKeyValues(rows) { return rows.map(bulkKeyValueLine).join("\n"); }

/** @param {string} line */
function parseLine(line) {
  if (!line.trim()) return null;
  if (line.trimStart().startsWith("[")) {
    try {
      const tuple = JSON.parse(line);
      if (Array.isArray(tuple) && tuple.length >= 2 && tuple.length <= 4 &&
          (tuple.length < 3 || typeof tuple[2] === "boolean") && (tuple.length < 4 || typeof tuple[3] === "boolean"))
        return {name:tuple[0],value:tuple[1],disabled:tuple[2] === true,noValue:tuple[3] === true};
    } catch { /* Partial JSON remains editable as an ordinary literal line. */ }
  }
  let text = line.trim(), disabled = false;
  if (text.startsWith("# ")) { disabled = true; text = text.slice(2); }
  const colon = text.indexOf(":");
  return {name:(colon < 0 ? text : text.slice(0,colon)).trim(),value:colon < 0 ? "" : text.slice(colon+1).trim(),disabled,noValue:false};
}
/** @param {Record<string,any>} row */
const key = row => JSON.stringify([row.name === undefined ? "" : row.name,row.value === undefined ? "" : row.value,Boolean(row.disabled),row.noValue === true]);
/** Match exact rows before same-name edits or positional renames, preserving
 * duplicate identities, order and opaque metadata without mutating originals.
 * @param {string} text @param {Record<string,any>[]} previous */
export function parseBulkKeyValues(text,previous) {
  const rows = text.split(/\r\n|\r|\n/).map(parseLine).filter(row=>row!==null);
  /** @type {Map<string,{indices:number[],cursor:number}>} */ const exact = new Map(), names = new Map();
  /** @param {Map<string,{indices:number[],cursor:number}>} map @param {string} key @param {number} index */
  const add = (map,key,index) => { const bucket = map.get(key); if(bucket) bucket.indices.push(index); else map.set(key,{indices:[index],cursor:0}); };
  previous.forEach((row,index)=>{ add(exact,key(row),index); add(names,String(row.name ?? ""),index); });
  const used = new Set();
  /** @param {Map<string,{indices:number[],cursor:number}>} map @param {string} key */
  const take = (map,key) => {
    const bucket = map.get(key); if(!bucket) return undefined;
    while(bucket.cursor<bucket.indices.length) { const index=bucket.indices[bucket.cursor++]; if(!used.has(index)){used.add(index);return index;} }
    return undefined;
  };
  const identities = rows.map((row,index)=>{
    if(previous[index] && key(previous[index])===key(row)){used.add(index);return index;}
    return undefined;
  });
  rows.forEach((row,index)=>{if(identities[index]===undefined) identities[index]=take(exact,key(row));});
  rows.forEach((row,index)=>{ if(identities[index]===undefined) identities[index]=take(names,String(row.name ?? "")); });
  return rows.map((row,index)=>{
    let identity=identities[index];
    if(identity===undefined && previous[index] && !used.has(index)){identity=index;used.add(index);}
    const original=identity===undefined ? null : previous[identity];
    if(original && key(original)===key(row)) return original;
    /** @type {Record<string,any>} */ const result={...original,name:row.name,value:row.value,disabled:row.disabled};
    if(row.noValue || original && Object.hasOwn(original,"noValue")) result.noValue=row.noValue;
    return result;
  });
}

/** Resolve tuple-string template offsets without letting quotes in another
 * ordinary line affect JSON decoding or insertion escaping.
 * @param {string} source @param {number} start @param {number} end */
export function bulkTemplateRange(source,start,end) {
  const begin=source.lastIndexOf("\n",Math.max(0,start-1))+1;
  const next=source.indexOf("\n",start), finish=next<0 ? source.length : next;
  const line=source.slice(begin,finish);
  if(line.trimStart().startsWith("[") && end<=finish){
    const range=templateEditorRange(line,start-begin,end-begin,true);
    return {...range,start:range.start+begin,end:range.end+begin};
  }
  return templateEditorRange(source,start,end,false);
}
