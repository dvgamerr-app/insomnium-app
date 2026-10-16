/** Read a MIME parameter without splitting quoted semicolons.
 * @param {string} value @param {string} name */
export function mimeParameter(value,name) {
  const parameters = /;\s*([!#$%&'*+.^_`|~\w-]+)\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^;\s]*))/g;
  for (const match of value.matchAll(parameters))
    if (match[1].toLowerCase()===name.toLowerCase()) return match[2]===undefined?match[3]:match[2].replace(/\\(.)/g,'$1');
  return '';
}
/** @param {string[][]} headers @param {string} name */
export function partHeader(headers,name) {return headers.find(row=>row[0].toLowerCase()===name)?.[1]||'';}
