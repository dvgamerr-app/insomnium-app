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
/** @param {string} binary */
function decodeText(binary,charset='utf-8') {
  const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  try {return new TextDecoder(charset).decode(bytes);} catch {return new TextDecoder().decode(bytes);}
}
/** Parse boundaries in a byte-preserving binary string, never decoded body text.
 * @param {string|undefined} base64 @param {string} contentType */
export function parseMultipart(base64,contentType) {
  if (!base64) throw new Error('Original multipart bytes are unavailable.');
  const boundary=mimeParameter(contentType,'boundary');
  if (!boundary || boundary.length>70 || !/^[0-9A-Za-z'()+_,.\/:=? -]+$/.test(boundary) || boundary.endsWith(' '))
    throw new Error('Invalid or missing multipart boundary.');
  const binary=atob(base64);
  const escaped=boundary.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const delimiter=new RegExp('(?:^|\\r\\n)--'+escaped+'(--)?[ \\t]*(?:\\r\\n|$)','g');
  let previous=delimiter.exec(binary);
  if (!previous) throw new Error('Multipart boundary was not found.');
  /** @type {{name:string,filename:string,headers:string[][],body:string,bodyBase64:string,size:number}[]} */
  const parts=[];
  if (previous[1]) return parts;
  for (;;) {
    const next=delimiter.exec(binary);
    if (!next) throw new Error('Multipart closing boundary is missing.');
    const raw=binary.slice(previous.index+previous[0].length,next.index);
    const split=raw.indexOf('\r\n\r\n');
    // A part with no headers has a single blank CRLF before its body.
    const emptyHeaders=raw.startsWith('\r\n');
    if (split<0 && !emptyHeaders) throw new Error('Multipart part has no header terminator.');
    const headerText=emptyHeaders?'':decodeText(raw.slice(0,split));
    /** @type {string[][]} */ const headers=[];
    for (const line of headerText.split('\r\n')) {
      if (!line) continue;
      if (/^[ \t]/.test(line) && headers.length) {headers[headers.length-1][1]+=' '+line.trim();continue;}
      const colon=line.indexOf(':');
      if (colon<1 || !/^[!#$%&'*+.^_`|~\w-]+$/.test(line.slice(0,colon))) throw new Error('Invalid multipart part header.');
      headers.push([line.slice(0,colon),line.slice(colon+1).trim()]);
    }
    const bytes=raw.slice(emptyHeaders?2:split+4);
    const disposition=partHeader(headers,'content-disposition');
    parts.push({name:mimeParameter(disposition,'name')||`Part ${parts.length+1}`,
      filename:mimeParameter(disposition,'filename'),headers,bodyBase64:btoa(bytes),size:bytes.length,
      body:decodeText(bytes,mimeParameter(partHeader(headers,'content-type'),'charset')||'utf-8')});
    if(next[1]) return parts;
    previous=next;
  }
}
