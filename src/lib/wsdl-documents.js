import {DOMParser, onErrorStopParsing} from '@xmldom/xmldom';

const WSDL = 'http://schemas.xmlsoap.org/wsdl/';
const XSD = 'http://www.w3.org/2001/XMLSchema';
const origin = 'https://selected-wsdl.invalid/';
const adoptedNamespaces = new WeakMap();
/** Namespace adoption affects only absent-namespace QName references in a clone.
 * @param {any} node @returns {string} */
export function adoptedWsdlNamespace(node) {
  for (let current=node;current;current=current.parentNode) {
    const namespace = adoptedNamespaces.get(current);
    if (namespace) return namespace;
  }
  return '';
}
/** @typedef {{name:string,text:string}} WsdlDocument */
/** @param {string} name */
function documentUrl(name) {
  if (!name || /^[\\/]|^[A-Za-z][\w+.-]*:/.test(name) || name.includes('\0') || name.split(/[\\/]/).some(part=>part === '..' || part === '.'))
    throw new Error('WSDL document names must be relative selected-file paths.');
  return new URL(name.replaceAll('\\','/').split('/').map(encodeURIComponent).join('/'),origin).href;
}
/** @param {string} text */
function parseXml(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('WSDL document types and entities are not supported.');
  const document = new DOMParser({onError:onErrorStopParsing}).parseFromString(text,'application/xml');
  const root = document.documentElement;
  if (!root || !((root.namespaceURI === WSDL && root.localName === 'definitions') || (root.namespaceURI === XSD && root.localName === 'schema')))
    throw new Error('Selected WSDL dependencies must be WSDL 1.1 or XML Schema documents.');
  return document;
}
/** Resolve only explicitly supplied text. No host filesystem or network access.
 * @param {string} text @param {{name?:string,documents?:WsdlDocument[]}} [options] */
export function wsdlDocuments(text, options = {}) {
  const rootName = options.name || 'root.wsdl';
  const rootUrl = documentUrl(rootName);
  const files = [{name:rootName,text},...(options.documents || [])];
  if (files.length > 128) throw new Error('WSDL import exceeds 128 selected documents.');
  let bytes = 0;
  /** @type {Map<string,WsdlDocument>} */ const selected = new Map();
  for (const file of files) {
    if (typeof file.name !== 'string' || typeof file.text !== 'string') throw new Error('Invalid selected WSDL document.');
    bytes += new TextEncoder().encode(file.text).byteLength;
    if (bytes > 64 * 1024 * 1024) throw new Error('Selected WSDL documents exceed 64 MiB.');
    const url = documentUrl(file.name);
    if (selected.has(url)) throw new Error('Duplicate selected WSDL document path.');
    selected.set(url,file);
  }
  /** @type {Map<string,any>} */ const parsed = new Map();
  /** @type {Map<string,any>} */ const originals = new Map();
  const used = new Set();
  let contextBytes = 0;
  /** @type {{url:string,namespace?:string,kind?:string,include?:boolean,depth:number}[]} */
  const queue = [{url:rootUrl,kind:WSDL,depth:0}];
  for (let i=0;i<queue.length;i++) {
    const entry = queue[i];
    if (entry.depth > 32 || queue.length > 4096) throw new Error('WSDL import graph exceeds resolution limits.');
    const file = selected.get(entry.url);
    if (!file) throw new Error('A WSDL dependency was not selected. Select the root WSDL and its referenced WSDL/XSD files together.');
    let original = originals.get(entry.url);
    if (!original) { original = parseXml(file.text); originals.set(entry.url,original); }
    const sourceRoot = original.documentElement;
    const adopt = entry.include && entry.kind === XSD && !sourceRoot.hasAttribute('targetNamespace') && !!entry.namespace;
    const contextKey = JSON.stringify([entry.url,adopt ? entry.namespace : null]);
    let document = parsed.get(contextKey);
    const fresh = !document;
    if (!document) {
      contextBytes += new TextEncoder().encode(file.text).byteLength;
      if (contextBytes > 64 * 1024 * 1024) throw new Error('WSDL namespace contexts exceed 64 MiB.');
      document = adopt ? original.cloneNode(true) : original;
      if (adopt) {
        document.documentElement.setAttribute('targetNamespace',entry.namespace);
        adoptedNamespaces.set(document.documentElement,entry.namespace);
      }
      parsed.set(contextKey,document);
    }
    const root = document.documentElement;
    if (root.namespaceURI !== entry.kind || (entry.namespace !== undefined && (root.getAttribute('targetNamespace') || '') !== entry.namespace))
      throw new Error('WSDL dependency namespace mismatch.');
    used.add(entry.url);
    if (!fresh) continue;
    for (const node of Array.from(document.getElementsByTagNameNS('*','*'))) {
      const wsdlImport = node.namespaceURI === WSDL && node.localName === 'import';
      const schemaImport = node.namespaceURI === XSD && node.localName === 'import';
      const include = node.namespaceURI === XSD && node.localName === 'include';
      if (node.namespaceURI === XSD && node.localName === 'redefine') throw new Error('WSDL schema redefine is not yet supported.');
      if (!wsdlImport && !schemaImport && !include) continue;
      const location = node.getAttribute(wsdlImport ? 'location' : 'schemaLocation');
      if (schemaImport && !location) {
        const namespace = node.getAttribute('namespace') || '';
        // A selected namespace may be composed from several XSD files. Inline
        // schemas are checked after the explicit WSDL graph is fully resolved.
        for (const [url,candidate] of selected) {
          let candidateDocument = originals.get(url);
          if (!candidateDocument) { candidateDocument = parseXml(candidate.text); originals.set(url,candidateDocument); }
          const candidateRoot = candidateDocument.documentElement;
          if (candidateRoot.namespaceURI === XSD && (candidateRoot.getAttribute('targetNamespace') || '') === namespace)
            queue.push({url,namespace,kind:XSD,depth:entry.depth+1});
        }
        continue;
      }
      if (!location) throw new Error('WSDL imports/includes require an explicit selected-file location.');
      const url = new URL(location,entry.url);
      if (url.hash || url.username || url.password || !selected.has(url.href))
        throw new Error('A WSDL dependency was not selected. Select the root WSDL and its referenced WSDL/XSD files together.');
      const namespace = include ? node.parentNode?.nodeType === 1
        ? /** @type {any} */ (node.parentNode).getAttribute('targetNamespace') || '' : ''
        : node.getAttribute('namespace') || '';
      queue.push({url:url.href,namespace,kind:wsdlImport ? WSDL : XSD,include,depth:entry.depth+1});
    }
  }
  const documents = [...parsed.values()];
  const schemaNodes = documents.flatMap(document=>Array.from(document.getElementsByTagNameNS(XSD,'schema')));
  if (used.size !== selected.size) throw new Error('Some selected WSDL/XSD files are not referenced by the root document.');
  return {
    document:originals.get(rootUrl),
    roots:documents.map(document=>document.documentElement).filter(root=>root.namespaceURI === WSDL),
    schemas:schemaNodes,
    name:rootName,
    sources:files.slice(1).map(file=>({...file})),
  };
}
/** Find a unique entry WSDL, retaining relative directory paths for dependencies.
 * @param {WsdlDocument[]} files */
export function selectWsdlRoot(files) {
  if (!files.length || files.length > 128) throw new Error('Select one WSDL root and at most 127 dependencies.');
  if (files.reduce((total,file)=>total+new TextEncoder().encode(file.text).byteLength,0) > 64 * 1024 * 1024)
    throw new Error('Selected WSDL documents exceed 64 MiB.');
  const parsed = files.map(file=>({file,url:documentUrl(file.name),document:parseXml(file.text)}));
  const incoming = new Set();
  for (const item of parsed) for (const node of Array.from(item.document.getElementsByTagNameNS(WSDL,'import'))) {
    const location = node.getAttribute('location');
    if (location) incoming.add(new URL(location,item.url).href);
  }
  const candidates = parsed.filter(item=>item.document.documentElement?.namespaceURI === WSDL && !incoming.has(item.url));
  if (candidates.length !== 1) throw new Error('Select a document set with exactly one WSDL import root.');
  const root = candidates[0].file;
  return {text:root.text,name:root.name,documents:files.filter(file=>file !== root)};
}
