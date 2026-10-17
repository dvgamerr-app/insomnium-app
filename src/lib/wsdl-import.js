import {id, newRequest} from './model.js';
import {wsdlDocuments, adoptedWsdlNamespace} from './wsdl-documents.js';

const WSDL = 'http://schemas.xmlsoap.org/wsdl/';
const XSD = 'http://www.w3.org/2001/XMLSchema';
const SOAP = 'http://schemas.xmlsoap.org/wsdl/soap/';
const SOAP12 = 'http://schemas.xmlsoap.org/wsdl/soap12/';
const escape = (/** @type {string} */ value) => value.replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c] || c);
/** @param {string} name */
function builtinSample(name) {
  if (/^(?:byte|short|int|integer|long|unsigned\w+|positiveInteger|negativeInteger|nonPositiveInteger|nonNegativeInteger|decimal|float|double)$/.test(name))
    return name === 'positiveInteger' ? '1' : /^(negativeInteger|nonPositiveInteger)$/.test(name) ? '-1' : '0';
  return ({boolean:'false',date:'2000-01-01',dateTime:'2000-01-01T00:00:00Z',time:'00:00:00Z',base64Binary:'',hexBinary:''})[name] ?? 'string';
}
/** Exact integer ranges; do not round schema bounds through JavaScript Number.
 * @type {Record<string,[bigint|null,bigint|null]>} */
const integerRanges = {
  integer:[null,null], nonPositiveInteger:[null,0n], negativeInteger:[null,-1n],
  nonNegativeInteger:[0n,null], positiveInteger:[1n,null],
  byte:[-128n,127n], short:[-32768n,32767n], int:[-2147483648n,2147483647n],
  long:[-9223372036854775808n,9223372036854775807n],
  unsignedByte:[0n,255n], unsignedShort:[0n,65535n], unsignedInt:[0n,4294967295n],
  unsignedLong:[0n,18446744073709551615n],
};
const numericFacets = ['minInclusive','minExclusive','maxInclusive','maxExclusive','totalDigits','fractionDigits'];
const stringFacets = ['length','minLength','maxLength','whiteSpace'];
/** @type {Record<string,string>} */
const builtinTypeParents = {
  anySimpleType:'anyType', normalizedString:'string', token:'normalizedString', language:'token',
  Name:'token', NCName:'Name', ID:'NCName', IDREF:'NCName', ENTITY:'NCName', NMTOKEN:'token',
  integer:'decimal', nonPositiveInteger:'integer', negativeInteger:'nonPositiveInteger',
  long:'integer', int:'long', short:'int', byte:'short', nonNegativeInteger:'integer',
  unsignedLong:'nonNegativeInteger', unsignedInt:'unsignedLong', unsignedShort:'unsignedInt',
  unsignedByte:'unsignedShort', positiveInteger:'nonNegativeInteger',
};
const primitiveTypes = new Set(['string','boolean','decimal','float','double','duration','dateTime',
  'time','date','gYearMonth','gYear','gMonthDay','gDay','gMonth','hexBinary','base64Binary','anyURI','QName','NOTATION']);
/** Inline simpleType is a base declaration, not a constraining facet.
 * @param {any} restriction @returns {any[]} */
function restrictionFacets(restriction) {
  return children(restriction,XSD).filter(child=>!['annotation','simpleType'].includes(child.localName) &&
    !(simpleContentContext(restriction) && ['attribute','attributeGroup','anyAttribute'].includes(child.localName)));
}
/** @param {any} node */
function simpleContentContext(node) {
  return node.parentNode?.namespaceURI === XSD && node.parentNode?.localName === 'simpleContent';
}
/** @param {any} restriction @param {[bigint,bigint|null]|null} range
 * @returns {[bigint,bigint|null]|null} */
function stringRestrictionRange(restriction,range) {
  const facets = restrictionFacets(restriction);
  if (!range || facets.some(child=>!stringFacets.includes(child.localName))) return null;
  let [min,max] = range;
  for (const facet of facets) {
    const text = (facet.getAttribute('value') || '').trim();
    if (facet.localName === 'whiteSpace') {
      if (!['preserve','replace','collapse'].includes(text)) throw new Error('Invalid WSDL whiteSpace facet.');
      continue;
    }
    if (!/^\+?\d{1,128}$/.test(text)) throw new Error('WSDL string lengths require nonnegative decimal integers.');
    const value = BigInt(text);
    if (facet.localName !== 'maxLength') min = value > min ? value : min;
    if (facet.localName !== 'minLength') max = max === null || value < max ? value : max;
  }
  if (max !== null && min > max) throw new Error('WSDL length restriction has no valid example length.');
  return [min,max];
}
/** @param {any} facet */
function digitFacet(facet) {
  const text = (facet.getAttribute('value') || '').trim();
  if (!/^\+?\d{1,3}$/.test(text) || Number(text) > 128 ||
      (facet.localName === 'totalDigits' && Number(text) === 0))
    throw new Error('WSDL digit facets require totalDigits 1–128 or fractionDigits 0–128.');
  return Number(text);
}
/** @param {any} restriction @param {[bigint|null,bigint|null]|null} range
 * @returns {[bigint|null,bigint|null]|null} */
function integerRestrictionRange(restriction,range) {
  const facets = restrictionFacets(restriction);
  if (!range || facets.some(child=>!numericFacets.includes(child.localName))) return null;
  let [min,max] = range;
  for (const facet of facets) {
    if (facet.localName === 'fractionDigits') {
      if (digitFacet(facet) !== 0) throw new Error('WSDL integer fractionDigits must remain zero.');
      continue;
    }
    if (facet.localName === 'totalDigits') {
      const limit = 10n ** BigInt(digitFacet(facet))-1n;
      min = min === null || min < -limit ? -limit : min;
      max = max === null || max > limit ? limit : max;
      continue;
    }
    const text = (facet.getAttribute('value') || '').trim();
    if (!/^[+-]?\d{1,128}$/.test(text)) throw new Error('WSDL integer bounds require at most 128 decimal digits.');
    let value = BigInt(text);
    if (facet.localName === 'minExclusive') value++;
    if (facet.localName === 'maxExclusive') value--;
    if (facet.localName.startsWith('min')) min = min === null || value > min ? value : min;
    else max = max === null || value < max ? value : max;
  }
  if (min !== null && max !== null && min > max) throw new Error('WSDL integer restriction has no valid example value.');
  return [min,max];
}
/** Choose a finite decimal on a common exact grid. One extra decimal place
 * provides an interior value for any nonempty exclusive-bound interval.
 * @param {any[]} facets */
function decimalRestrictionSample(facets) {
  let fractionDigits = 129, totalDigits = 129;
  for (const facet of facets) {
    if (facet.localName === 'fractionDigits') fractionDigits = Math.min(fractionDigits,digitFacet(facet));
    if (facet.localName === 'totalDigits') totalDigits = Math.min(totalDigits,digitFacet(facet));
  }
  const bounds = facets.filter(facet=>!['totalDigits','fractionDigits'].includes(facet.localName)).map(facet=>{
    const text = (facet.getAttribute('value') || '').trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || text.replace(/\D/g,'').length > 128)
      throw new Error('WSDL decimal bounds require at most 128 decimal digits without exponents.');
    const scale = text.includes('.') ? text.length-text.indexOf('.')-1 : 0;
    return {kind:facet.localName,scale,value:BigInt(text.replace('.',''))};
  });
  const scale = Math.min(fractionDigits,bounds.reduce((max,bound)=>Math.max(max,bound.scale),0)+1);
  /** @type {bigint|null} */ let min = null;
  /** @type {bigint|null} */ let max = null;
  for (const bound of bounds) {
    const divisor = 10n ** BigInt(Math.max(0,bound.scale-scale));
    const numerator = bound.value * 10n ** BigInt(Math.max(0,scale-bound.scale));
    const quotient = numerator/divisor, remainder = numerator%divisor;
    const floor = quotient-(remainder < 0n ? 1n : 0n);
    const ceil = quotient+(remainder > 0n ? 1n : 0n);
    const value = bound.kind === 'minExclusive' ? floor+1n
      : bound.kind === 'maxExclusive' ? ceil-1n
      : bound.kind === 'minInclusive' ? ceil : floor;
    if (bound.kind.startsWith('min')) min = min === null || value > min ? value : min;
    else max = max === null || value < max ? value : max;
  }
  if (totalDigits < 129) {
    const limit = 10n ** BigInt(totalDigits+scale)-1n;
    min = min === null || min < -limit ? -limit : min;
    max = max === null || max > limit ? limit : max;
  }
  if (min !== null && max !== null && min > max) throw new Error('WSDL decimal restriction has no valid example value.');
  let value = 0n;
  if (min !== null && value < min) value = min;
  if (max !== null && value > max) value = max;
  if (value !== 0n && totalDigits < 129) {
    const magnitude = value < 0n ? -value : value;
    const quantum = 10n ** BigInt(Math.max(0,String(magnitude).length-totalDigits));
    const rounded = ((magnitude+quantum-1n)/quantum)*quantum;
    value = value < 0n ? -rounded : rounded;
    if ((min !== null && value < min) || (max !== null && value > max))
      throw new Error('WSDL decimal digit constraints have no valid example value.');
  }
  if (scale === 0) return String(value);
  const negative = value < 0n;
  const digits = String(negative ? -value : value).padStart(scale+1,'0');
  const result = (digits.slice(0,-scale)+'.'+digits.slice(-scale)).replace(/0+$/,'').replace(/\.$/,'');
  return (negative ? '-' : '')+result;
}
/** @param {any} node @param {string} [namespace] @param {string} [name] @returns {any[]} */
function children(node, namespace, name) {
  return Array.from(node?.childNodes || []).filter((/** @type {any} */ child) =>
    child.nodeType === 1 && (!namespace || child.namespaceURI === namespace) && (!name || child.localName === name));
}
/** @param {any} node @param {string} value */
function qname(node, value) {
  const parts = value.split(':');
  if (parts.length > 2 || !parts.every(part => /^[A-Za-z_][\w.-]*$/.test(part)))
    throw new Error('Invalid WSDL qualified name.');
  const namespace = node.lookupNamespaceURI(parts.length === 2 ? parts[0] : null) ||
    (parts.length === 1 ? adoptedWsdlNamespace(node) : '');
  if (parts.length === 2 && !namespace) throw new Error('Unresolved WSDL namespace prefix.');
  return namespace + '#' + parts.at(-1);
}

/** Selected WSDL 1.1 SOAP 1.1/1.2 literal import. No network or file reads.
 * @param {string} text @param {{name?:string,documents?:import('./wsdl-documents.js').WsdlDocument[]}} [options]
 * @returns {Record<string,any>[]} */
export function wsdlResources(text,options = {}) {
  const bundle = wsdlDocuments(text,options);
  const document = bundle.document;
  const root = document.documentElement;
  if (!root || root.namespaceURI !== WSDL || root.localName !== 'definitions')
    throw new Error('Expected WSDL 1.1 definitions.');
  /** @type {Map<string,any>} */ const definitions = new Map();
  for (const definitionRoot of bundle.roots) for (const node of children(definitionRoot)) {
    if (node.namespaceURI !== WSDL || !['message','portType','binding'].includes(node.localName)) continue;
    const key = node.localName + ':' + (definitionRoot.getAttribute('targetNamespace') || '') + '#' + node.getAttribute('name');
    if (definitions.has(key)) throw new Error('Duplicate WSDL definition.');
    definitions.set(key,node);
  }
  /** @type {Map<string,any>} */ const schemas = new Map();
  for (const schema of bundle.schemas) {
    const namespace = schema.getAttribute('targetNamespace') || '';
    for (const node of children(schema,XSD)) {
      if (!['element','complexType','simpleType','group','attribute','attributeGroup'].includes(node.localName)) continue;
      const key = node.localName + ':' + namespace + '#' + node.getAttribute('name');
      if (schemas.has(key)) throw new Error('Duplicate WSDL schema declaration.');
      schemas.set(key,{node,schema,namespace});
    }
  }
  /** @param {string} kind @param {any} node @param {string} value */
  function definition(kind,node,value) {
    const found = definitions.get(kind + ':' + qname(node,value));
    if (!found) throw new Error('Unresolved WSDL ' + kind + '.');
    return found;
  }
  let generated = 0;
  let generatedBytes = 0;
  const encoder = new TextEncoder();
  /** Charge each generated node before concatenating it into its parent.
   * @param {string} value */
  function bounded(value) {
    generatedBytes += encoder.encode(value).byteLength;
    if (generatedBytes > 8 * 1024 * 1024) throw new Error('WSDL examples exceed 8 MiB.');
    return value;
  }
  /** @param {number} depth */
  function enter(depth) {
    if (depth > 32 || ++generated > 10000) throw new Error('WSDL example exceeds generation limits.');
  }
  /** @param {any} context @param {string} name @param {boolean} [complex]
   * @returns {{node:any,builtin:string}} */
  function resolveTextType(context,name,complex=false) {
    if (context.namespaceURI === XSD && context.localName === 'restriction') {
      const inline = children(context,XSD,'simpleType');
      if(inline.length > 1)throw new Error('WSDL restriction accepts at most one inline simple type.');
      if (!context.hasAttribute('base')) {
        if (inline.length !== 1 || simpleContentContext(context)) throw new Error('WSDL restriction requires a supported base type.');
        return {node:inline[0],builtin:''};
      }
      if (inline.length && !simpleContentContext(context)) throw new Error('WSDL restriction cannot combine named and inline base types.');
    }
    const key = qname(context,name || '');
    if (key.startsWith(XSD+'#')) return {node:null,builtin:key.slice(XSD.length+1)};
    const found = schemas.get('simpleType:'+key) || ((complex || simpleContentContext(context)) && schemas.get('complexType:'+key));
    if (!found) throw new Error('Unresolved WSDL text base type.');
    return {node:found.node,builtin:''};
  }
  /** A simple-content restriction's inline type narrows its scalar content;
   * its named complex base still owns attribute/type inheritance.
   * @param {any} context @param {string} name */
  function resolveScalarType(context,name) {
    const resolved=resolveTextType(context,name);
    const inline=simpleContentContext(context) ? children(context,XSD,'simpleType')[0] : null;
    return inline ? {node:inline,builtin:''} : resolved;
  }
  /** @param {any} type @returns {any} */
  function scalarDerivation(type) {
    const content=type.localName === 'simpleType' ? type : children(type,XSD,'simpleContent')[0];
    return children(content,XSD).find(child=>['restriction','extension'].includes(child.localName));
  }
  /** Resolve every named base before applying a derived restriction. The same
   * generation guard rejects cycles across selected schema documents.
   * @param {any} context @param {string} name @param {number} depth
   * @returns {[bigint|null,bigint|null]|null} */
  function integerTypeRange(context,name,depth) {
    enter(depth);
    const {node,builtin} = resolveScalarType(context,name);
    if (builtin) {
      return Object.hasOwn(integerRanges,builtin) ? integerRanges[builtin] : null;
    }
    const restriction = scalarDerivation(node);
    if (!restriction) return null;
    const base=integerTypeRange(restriction,restriction.getAttribute('base') || '',depth+1);
    return restriction.localName === 'extension' ? base : integerRestrictionRange(restriction,base);
  }
  /** @param {any} context @param {string} name @param {number} depth
   * @returns {any[]|null} */
  function decimalTypeFacets(context,name,depth) {
    enter(depth);
    const {node,builtin} = resolveScalarType(context,name);
    if (builtin) return builtin === 'decimal' ? [] : null;
    const restriction = scalarDerivation(node);
    if (!restriction) return null;
    const own = restriction.localName === 'extension' ? [] : restrictionFacets(restriction);
    if (own.some(child=>!numericFacets.includes(child.localName))) return null;
    const inherited = decimalTypeFacets(restriction,restriction.getAttribute('base') || '',depth+1);
    if (inherited === null) return null;
    if (own.length+inherited.length > 10000) throw new Error('WSDL decimal facets exceed generation limits.');
    return [...inherited,...own];
  }
  /** @param {any} context @param {string} name @param {number} depth
   * @returns {[bigint,bigint|null]|null} */
  function stringTypeRange(context,name,depth) {
    enter(depth);
    const {node,builtin} = resolveScalarType(context,name);
    if (builtin) return ['string','normalizedString','token','anyURI'].includes(builtin) ? [0n,null] : null;
    const restriction = scalarDerivation(node);
    if (!restriction) return null;
    const base=stringTypeRange(restriction,restriction.getAttribute('base') || '',depth+1);
    return restriction.localName === 'extension' ? base : stringRestrictionRange(restriction,base);
  }
  /** @param {any} restriction @param {string} [kind] */
  function checkCollapsedWhitespace(restriction,kind='list') {
    if (children(restriction,XSD,'whiteSpace').some(facet=>(facet.getAttribute('value') || '').trim() !== 'collapse'))
      throw new Error(`WSDL ${kind} whiteSpace must remain collapse.`);
  }
  /** @param {any} context @param {string} name @param {number} depth
   * @returns {{type:any,min:bigint,max:bigint|null,item?:string}|null} */
  function listTypeInfo(context,name,depth) {
    enter(depth);
    const {node,builtin} = resolveScalarType(context,name);
    if (builtin) return ['NMTOKENS','IDREFS','ENTITIES'].includes(builtin)
      ? {type:null,min:1n,max:null,item:'string'} : null;
    if (children(node,XSD,'list').length) return {type:node,min:0n,max:null};
    const restriction = scalarDerivation(node);
    if (!restriction) return null;
    const base = listTypeInfo(restriction,restriction.getAttribute('base') || '',depth+1);
    if (!base) return null;
    if(restriction.localName === 'extension')return base;
    checkCollapsedWhitespace(restriction);
    const range = stringRestrictionRange(restriction,[base.min,base.max]);
    return range ? {...base,min:range[0],max:range[1]} : null;
  }
  /** @param {any} context @param {string} name @param {number} depth
   * @returns {{encoding:string,min:bigint,max:bigint|null}|null} */
  function binaryTypeInfo(context,name,depth) {
    enter(depth);
    const {node,builtin:encoding} = resolveScalarType(context,name);
    if (encoding) {
      return ['hexBinary','base64Binary'].includes(encoding) ? {encoding,min:0n,max:null} : null;
    }
    const restriction = scalarDerivation(node);
    if (!restriction) return null;
    const base = binaryTypeInfo(restriction,restriction.getAttribute('base') || '',depth+1);
    if (!base) return null;
    if(restriction.localName === 'extension')return base;
    checkCollapsedWhitespace(restriction,'binary');
    const range = stringRestrictionRange(restriction,[base.min,base.max]);
    return range ? {...base,min:range[0],max:range[1]} : null;
  }
  /** @param {any} list @param {number} depth @returns {string} */
  function listItem(list,depth) {
    enter(depth);
    const inline = children(list,XSD,'simpleType');
    const item = list.getAttribute('itemType');
    if ((!!item ? 1 : 0) + inline.length !== 1 ||
        children(list,XSD).some(child=>!['annotation','simpleType'].includes(child.localName)))
      throw new Error('WSDL list requires one named or inline item type.');
    const value = item ? textType(list,item,depth+1,true) : textValue(inline[0],depth+1);
    if (/[\x20\t\r\n]/.test(value)) throw new Error('WSDL list item example contains whitespace; author the example manually.');
    return value;
  }
  /** @param {any} context @param {string} name @param {number} depth @returns {string} */
  function textType(context,name,depth,simpleOnly=false) {
    enter(depth);
    const {node,builtin} = resolveTextType(context,name,!simpleOnly);
    return builtin ? builtinSample(builtin) : textValue(node,depth+1);
  }
  /** @param {any} type @param {number} depth @returns {string} */
  function textValue(type,depth) {
    enter(depth);
    const list = children(type,XSD,'list')[0];
    if (list) {
      return bounded(listItem(list,depth+1));
    }
    const union = children(type,XSD,'union')[0];
    if (union) {
      const names = (union.getAttribute('memberTypes') || '').trim().split(/\s+/).filter(Boolean);
      const inline = children(union,XSD,'simpleType');
      if ((!names.length && !inline.length) ||
          children(union,XSD).some(child=>!['annotation','simpleType'].includes(child.localName)))
        throw new Error('WSDL union requires a named or inline member type.');
      // Deterministic editable example: named members precede inline members.
      return bounded(names.length ? textType(union,names[0],depth+1,true) : textValue(inline[0],depth+1));
    }
    const restriction = type.localName === 'restriction' ? type : children(type,XSD,'restriction')[0];
    if (restriction) {
      resolveTextType(restriction,restriction.getAttribute('base') || '');
      const enumeration = children(restriction,XSD,'enumeration')[0];
      if (enumeration) return enumeration.getAttribute('value') || '';
      if (restrictionFacets(restriction).length) {
        const range = integerRestrictionRange(restriction,
          integerTypeRange(restriction,restriction.getAttribute('base') || '',depth+1));
        if (range !== null) {
          const [min,max] = range;
          let value = 0n;
          if (min !== null && value < min) value = min;
          if (max !== null && value > max) value = max;
          return String(value);
        }
        const own = restrictionFacets(restriction);
        if (own.every(child=>numericFacets.includes(child.localName))) {
          const inherited = decimalTypeFacets(restriction,restriction.getAttribute('base') || '',depth+1);
          if (inherited !== null) {
            if (own.length+inherited.length > 10000) throw new Error('WSDL decimal facets exceed generation limits.');
            return decimalRestrictionSample([...inherited,...own]);
          }
        }
        if (own.every(child=>stringFacets.includes(child.localName))) {
          const range = stringRestrictionRange(restriction,
            stringTypeRange(restriction,restriction.getAttribute('base') || '',depth+1));
          if (range !== null) {
            const [min,max] = range;
            let length = min > 6n ? min : 6n;
            if (max !== null && length > max) length = max;
            if (length > 8n*1024n*1024n) throw new Error('WSDL string example exceeds 8 MiB.');
            // ASCII has identical XML-character and UTF8 lengths and satisfies
            // preserve/replace/collapse without introducing whitespace.
            return bounded('x'.repeat(Number(length)));
          }
          const list = listTypeInfo(restriction,restriction.getAttribute('base') || '',depth+1);
          if (list) {
            checkCollapsedWhitespace(restriction);
            const range = stringRestrictionRange(restriction,[list.min,list.max]);
            if (!range) throw new Error('Unsupported WSDL list restriction.');
            const [min,max] = range;
            let count = min > 1n ? min : 1n;
            if (max !== null && count > max) count = max;
            const item = list.item ?? listItem(children(list.type,XSD,'list')[0],depth+1);
            if (count === 0n) return '';
            if (!item) throw new Error('WSDL nonempty list requires a nonempty item example.');
            const cost = count*BigInt(encoder.encode(escape(item)).byteLength+1)-1n;
            if (cost > 8n*1024n*1024n) throw new Error('WSDL list example exceeds 8 MiB.');
            return bounded((item+' ').repeat(Number(count-1n))+item);
          }
          const binary = binaryTypeInfo(restriction,restriction.getAttribute('base') || '',depth+1);
          if (binary) {
            checkCollapsedWhitespace(restriction,'binary');
            const range = stringRestrictionRange(restriction,[binary.min,binary.max]);
            if (!range) throw new Error('Unsupported WSDL binary restriction.');
            const count = range[0];
            const cost = binary.encoding === 'hexBinary' ? 2n*count : 4n*((count+2n)/3n);
            if (cost > 8n*1024n*1024n) throw new Error('WSDL binary example exceeds 8 MiB.');
            return bounded(binary.encoding === 'hexBinary' ? '00'.repeat(Number(count)) : btoa('\0'.repeat(Number(count))));
          }
        }
        throw new Error('WSDL simple-type restrictions require manual example authoring.');
      }
      const base=resolveScalarType(restriction,restriction.getAttribute('base') || '');
      return base.builtin ? builtinSample(base.builtin) : textValue(base.node,depth+1);
    }
    const derivation=scalarDerivation(type);
    if(!derivation)throw new Error('WSDL text types require a supported restriction or simpleContent derivation.');
    return derivation.localName === 'restriction' ? textValue(derivation,depth+1)
      : textType(derivation,derivation.getAttribute('base'),depth+1);
  }
  /** @typedef {{name:string,namespace:string,value:string,fixedValue?:string,required?:boolean}} ExampleAttribute */
  /** @param {any} type @param {any} schema @param {number} depth
   * @param {(attribute:{name:string,namespace:string,use:string})=>string|undefined} [onUse]
   * @param {boolean} [includeOptional]
   * @returns {ExampleAttribute[]} */
  function attributesFor(type,schema,depth,onUse,includeOptional=false) {
    enter(depth);
    /** @type {ExampleAttribute[]} */ let result = [];
    for (const child of children(type,XSD)) {
      if (child.localName === 'attribute') {
        const use = child.getAttribute('use') || 'optional';
        if (!['optional','required','prohibited'].includes(use)) throw new Error('Invalid WSDL attribute use.');
        if (use !== 'required' && !onUse && !includeOptional) continue;
        enter(depth+1);
        let declaration = child, ownerSchema = schema;
        if (child.hasAttribute('ref')) {
          const found = schemas.get('attribute:'+qname(child,child.getAttribute('ref')));
          if (!found) throw new Error('Unresolved WSDL attribute reference.');
          declaration = found.node; ownerSchema = found.schema;
        }
        const name = declaration.getAttribute('name');
        if (!name || (use === 'required' && !/^[A-Za-z_][\w.-]*$/.test(name)) || name === 'xmlns') throw new Error('Invalid WSDL attribute name.');
        const namespace = declaration.parentNode === ownerSchema ||
          (declaration.getAttribute('form') || ownerSchema.getAttribute('attributeFormDefault')) === 'qualified'
          ? ownerSchema.getAttribute('targetNamespace') || '' : '';
        const inheritedFixed=onUse?.({name,namespace,use});
        const fixedValue = child.getAttribute('fixed') ?? declaration.getAttribute('fixed') ?? inheritedFixed;
        if (use !== 'required') {
          if(includeOptional && use === 'optional')result.push({name,namespace,value:fixedValue ?? '',required:false,...(fixedValue != null ? {fixedValue} : {})});
          continue;
        }
        const fixed = fixedValue ?? child.getAttribute('default') ?? declaration.getAttribute('default');
        const inline = children(declaration,XSD,'simpleType')[0];
        const value = fixed ?? (inline ? textValue(inline,depth+1) : declaration.hasAttribute('type')
          ? textType(declaration,declaration.getAttribute('type'),depth+1) : 'string');
        result.push({name,namespace,value,...(fixedValue != null ? {fixedValue} : {})});
      } else if (child.localName === 'attributeGroup') {
        const found = schemas.get('attributeGroup:'+qname(child,child.getAttribute('ref')));
        if (!found) throw new Error('Unresolved WSDL attribute group.');
        result.push(...attributesFor(found.node,found.schema,depth+1,onUse,includeOptional));
      } else if (['complexContent','simpleContent'].includes(child.localName)) {
        const derivations = children(child,XSD).filter(item=>item.localName !== 'annotation');
        if (derivations.length !== 1 || !['extension','restriction'].includes(derivations[0].localName))
          throw new Error('WSDL content restrictions require manual example authoring.');
        const extension = derivations[0];
        const baseKey=qname(extension,extension.getAttribute('base'));
        const base = schemas.get('complexType:'+baseKey);
        if(child.localName === 'simpleContent' && base && blocksDerivation(base.node,base.schema,[extension.localName],'final'))
          throw new Error('WSDL base type forbids this derivation.');
        if(child.localName === 'complexContent' && baseKey !== XSD+'#anyType' && !base)
          throw new Error('Unresolved WSDL base complex type.');
        const inherited = base ? attributesFor(base.node,base.schema,depth+1,undefined,
          includeOptional || extension.localName === 'restriction') : [];
        if (extension.localName === 'extension') {
          result.push(...inherited,...attributesFor(extension,schema,depth+1,undefined,includeOptional));
        } else {
          const key=(/** @type {{name:string,namespace:string}} */ attribute)=>attribute.namespace+'#'+attribute.name;
          const byKey=new Map(inherited.map(attribute=>[key(attribute),attribute]));
          const replaced=new Set();
          const local=attributesFor(extension,schema,depth+1,attribute=>{
            const identity=key(attribute);replaced.add(identity);
            if(byKey.has(identity) && byKey.get(identity)?.required !== false && attribute.use !== 'required')
              throw new Error('WSDL restriction cannot remove a required base attribute.');
            return byKey.get(identity)?.fixedValue;
          },true).map(attribute=>{
            const previous=byKey.get(key(attribute));
            if(previous?.fixedValue == null)return attribute;
            if(attribute.fixedValue != null && attribute.fixedValue !== previous.fixedValue)
              throw new Error('WSDL restriction cannot change a fixed base attribute.');
            return {...attribute,value:previous.fixedValue,fixedValue:previous.fixedValue};
          });
          result.push(...[...inherited.filter(attribute=>!replaced.has(key(attribute))),...local]
            .filter(attribute=>includeOptional || attribute.required !== false));
        }
      } else if (child.localName === 'anyAttribute') {
        // Attribute wildcards permit additional attributes; none are required.
        wildcardSpec(child,schema);
      }
    }
    return result;
  }
  /** @param {ExampleAttribute[]} attributes */
  function attributeXml(attributes) {
    const seen = new Set();
    return bounded(attributes.map(({name,namespace,value},index)=>{
      const key = namespace+'#'+name;
      if (seen.has(key)) throw new Error('Duplicate WSDL example attribute.');
      seen.add(key);
      if (!namespace) return bounded(` ${name}="${escape(value)}"`);
      if (namespace === 'http://www.w3.org/XML/1998/namespace') return bounded(` xml:${name}="${escape(value)}"`);
      return bounded(` xmlns:a${index}="${escape(namespace)}" a${index}:${name}="${escape(value)}"`);
    }).join(''));
  }
  /** @param {any} node @param {any} schema */
  function wildcardSpec(node,schema) {
    const tokens=(node.getAttribute('namespace') ?? '##any').trim().split(/\s+/).filter(Boolean);
    const process=(node.getAttribute('processContents') ?? 'strict').trim();
    if(!tokens.length || !['strict','lax','skip'].includes(process) ||
        tokens.some((/** @type {string} */ token)=>token.startsWith('##') &&
          !['##any','##other','##local','##targetNamespace'].includes(token)) ||
        (tokens.length > 1 && tokens.some((/** @type {string} */ token)=>['##any','##other'].includes(token))))
      throw new Error('Invalid WSDL wildcard namespace or processContents.');
    const target=schema.getAttribute('targetNamespace') || '';
    const namespaces=tokens.map((/** @type {string} */ token)=>token==='##local' ? '' : token==='##targetNamespace' ? target : token);
    const allows=(/** @type {string} */ namespace)=>tokens[0]==='##any' ||
      (tokens[0]==='##other' ? !!namespace && namespace!==target : namespaces.includes(namespace));
    let placeholder=tokens[0]==='##any' ? '' : tokens[0]==='##other'
      ? 'urn:insomnium:example'+(target==='urn:insomnium:example' ? ':other' : '') : namespaces[0];
    if(placeholder==='http://www.w3.org/2000/xmlns/')
      throw new Error('WSDL wildcard uses a reserved namespace.');
    return {process,allows,placeholder};
  }
  const activeElements=new Set();
  const recursiveExpansion=new Error('WSDL example requires recursive element expansion.');
  /** @param {any} node @param {any} schema @param {number} depth */
  function wildcardSample(node,schema,depth) {
    const {process,allows,placeholder}=wildcardSpec(node,schema);
    if(process!=='skip')for(const [key,candidate] of schemas) {
      if(key.startsWith('element:') && allows(candidate.namespace) &&
          (!activeElements.has(candidate.node) || canNil(candidate.node)) &&
          !['true','1'].includes(candidate.node.getAttribute('abstract'))) {
        try { return sample(candidate.node,candidate.schema,depth+1); }
        catch(error) { if(error!==recursiveExpansion)throw error; }
      }
    }
    if(process==='strict')throw new Error('WSDL strict wildcard has no available concrete element declaration.');
    // Lax must not accidentally select a declared name whose type needs validation.
    let name='example';
    while(schemas.has('element:'+placeholder+'#'+name))name+='X';
    return bounded(`<${name} xmlns="${escape(placeholder)}"></${name}>`);
  }
  /** Render required occurrences of one schema particle. Optional paths stay empty.
   * @param {any} node @param {any} schema @param {number} depth @returns {string} */
  function particle(node,schema,depth) {
    enter(depth);
    const count = Number(node.getAttribute('minOccurs') || '1');
    const max = node.getAttribute('maxOccurs') || '1';
    if (!Number.isInteger(count) || count < 0 || count > 100 ||
        (max !== 'unbounded' && (!Number.isInteger(Number(max)) || Number(max) < count)))
      throw new Error('Invalid or excessive WSDL occurrence range.');
    let result = '';
    for (let i=0;i<count;i++) {
      if (node.localName === 'element') result += sample(node,schema,depth+1);
      else if (node.localName === 'any') result += wildcardSample(node,schema,depth+1);
      else if (node.localName === 'group' && node.hasAttribute('ref')) {
        const found = schemas.get('group:'+qname(node,node.getAttribute('ref')));
        if (!found) throw new Error('Unresolved WSDL model group.');
        result += particle(found.node,found.schema,depth+1);
      } else if (['sequence','all','choice','group'].includes(node.localName)) {
        const members = children(node,XSD).filter(child=>child.localName !== 'annotation');
        if(node.localName==='choice') {
          let chosen=false;
          for(const child of members) {
            try { result+=particle(child,schema,depth+1);chosen=true;break; }
            catch(error) { if(error!==recursiveExpansion)throw error; }
          }
          if(!chosen)throw recursiveExpansion;
        } else for (const child of members) result += particle(child,schema,depth+1);
      } else throw new Error('Unsupported WSDL schema particle.');
      // Enforce the expansion budget during repetitions, before joining parents.
      if (encoder.encode(result).byteLength > 8 * 1024 * 1024) throw new Error('WSDL examples exceed 8 MiB.');
    }
    return bounded(result);
  }
  /** Extensions prepend base fields; restrictions replace particles. Each
   * declaration keeps its schema namespace.
   * @param {any} type @param {any} schema @param {number} depth @returns {string} */
  function complexFields(type,schema,depth) {
    enter(depth);
    // Mixed content permits text between particles; an editable example need
    // not invent prose, but must still generate the required child elements.
    let result = '';
    for (const child of children(type,XSD)) {
      if (['annotation','attribute','attributeGroup','anyAttribute'].includes(child.localName)) continue;
      if (['sequence','all','choice','group'].includes(child.localName)) result += particle(child,schema,depth+1);
      else if (child.localName === 'complexContent') {
        const derivations = children(child,XSD).filter(item=>item.localName !== 'annotation');
        if (derivations.length !== 1 || !['extension','restriction'].includes(derivations[0].localName))
          throw new Error('WSDL complex content requires one extension or restriction.');
        const extension = derivations[0];
        const base = qname(extension,extension.getAttribute('base'));
        if (base !== XSD+'#anyType') {
          const found = schemas.get('complexType:'+base);
          if (!found) throw new Error('Unresolved WSDL base complex type.');
          if(blocksDerivation(found.node,found.schema,[extension.localName],'final'))
            throw new Error('WSDL base type forbids this derivation.');
          if(extension.localName === 'extension')result += complexFields(found.node,found.schema,depth+1);
        }
        result += complexFields(extension,schema,depth+1);
      } else if (child.localName === 'simpleContent') result += escape(textValue(type,depth+1));
      else throw new Error('WSDL example generation does not yet support this complex type.');
    }
    return bounded(result);
  }
  /** @param {{node:any,schema:any}} declaration @param {any} [member] @param {number} [depth] */
  function substitutionBlocked(declaration,member,depth=0) {
    const value = declaration.node.hasAttribute('block') ? declaration.node.getAttribute('block')
      : declaration.schema.getAttribute('blockDefault') || '';
    const tokens = value.trim().split(/\s+/).filter(Boolean);
    if (tokens.some((/** @type {string} */ token)=>!['#all','substitution','extension','restriction'].includes(token)))
      throw new Error('Invalid WSDL element substitution block.');
    if (tokens.includes('#all') || tokens.includes('substitution')) return true;
    if (member) {
      const methods=typeDerivation(elementType(member.node),elementType(declaration.node),depth+1);
      return methods === null || methods.some(method=>tokens.includes(method)) ||
        (methods.length > 0 && blocksDerivation(declaration.node,declaration.schema,methods,'final'));
    }
    return false;
  }
  /** @param {any} element @returns {{node:any,builtin:string}} */
  function elementType(element) {
    if(element.hasAttribute('type'))return resolveTextType(element,element.getAttribute('type'),true);
    const node=children(element,XSD).find(child=>['simpleType','complexType'].includes(child.localName));
    return node ? {node,builtin:''} : {node:null,builtin:'anyType'};
  }
  /** @param {any} node @returns {any} */
  function typeSchema(node) {
    for(let owner=node;owner;owner=owner.parentNode)
      if(owner.namespaceURI===XSD && owner.localName==='schema')return owner;
    return null;
  }
  /** @param {any} node @param {any} schema @param {string[]} methods
   * @param {string} [attribute] */
  function blocksDerivation(node,schema,methods,attribute='block') {
    const value = node.hasAttribute(attribute) ? node.getAttribute(attribute)
      : schema?.getAttribute(attribute+'Default') || '';
    const tokens = value.trim().split(/\s+/).filter(Boolean);
    if (tokens.some((/** @type {string} */ token)=>!['#all','extension','restriction','substitution','list','union'].includes(token)))
      throw new Error('Invalid WSDL derivation constraint.');
    return tokens.includes('#all') || methods.some(method=>tokens.includes(method));
  }
  /** @param {{node:any,builtin?:string}} candidate @param {{node:any,builtin?:string}} head @param {number} depth
   * @returns {string[]|null} */
  function typeDerivation(candidate,head,depth) {
    let current=candidate;
    const seen=new Set();
    const methods=/** @type {string[]} */([]);
    for(let step=0;;step++) {
      enter(depth+step+1);
      const identity=current.builtin || current.node;
      if(seen.has(identity))return null;
      seen.add(identity);
      if(current.builtin ? current.builtin===head.builtin : !head.builtin && current.node===head.node)return methods;
      let method='restriction';
      /** @type {{node:any,builtin:string}} */ let parent;
      if(current.builtin) {
        const name=current.builtin;
        if(['NMTOKENS','IDREFS','ENTITIES'].includes(name)) {
          methods.push('restriction');method='list';parent={node:null,builtin:'anySimpleType'};
        } else {
          const base=Object.hasOwn(builtinTypeParents,name) ? builtinTypeParents[name] : primitiveTypes.has(name) ? 'anySimpleType' : '';
          if(!base)return null;
          parent={node:null,builtin:base};
        }
      } else {
        const content=current.node.localName==='simpleType' ? current.node
          : children(current.node,XSD).find(child=>['complexContent','simpleContent'].includes(child.localName));
        const derivation=children(content,XSD).find(child=>['extension','restriction','list','union'].includes(child.localName));
        if(!derivation)parent={node:null,builtin:'anyType'};
        else {
          method=derivation.localName;
          parent=['list','union'].includes(method) ? {node:null,builtin:'anySimpleType'}
            : resolveTextType(derivation,derivation.getAttribute('base') || '',true);
        }
      }
      if(parent.node && blocksDerivation(parent.node,typeSchema(parent.node),[method],'final'))return null;
      methods.push(method);current=parent;
    }
  }
  /** @param {any} head @param {any} schema @param {any} element
   * @param {any} elementSchema @param {number} depth @returns {any} */
  function concreteType(head,schema,element,elementSchema,depth) {
    for(const [key,candidate] of schemas) {
      if(!key.startsWith('complexType:') || ['true','1'].includes(candidate.node.getAttribute('abstract')))continue;
      const methods=typeDerivation(candidate,{node:head},depth+1);
      if(methods && !blocksDerivation(head,schema,methods) && !blocksDerivation(element,elementSchema,methods))return candidate;
    }
    throw new Error('WSDL abstract type has no permitted concrete derived type.');
  }
  /** Find a concrete member in source order, including transitive groups.
   * @param {any} head @param {any} schema @param {number} depth @returns {any} */
  function concreteElement(head,schema,depth) {
    if (substitutionBlocked({node:head,schema})) throw new Error('WSDL abstract element blocks substitution.');
    for (const [key,candidate] of schemas) {
      if (!key.startsWith('element:') || ['true','1'].includes(candidate.node.getAttribute('abstract'))) continue;
      let current = candidate;
      const seen = new Set([current.node]);
      const ancestors = [];
      for (let step=0;current.node.hasAttribute('substitutionGroup');step++) {
        enter(depth+step+1);
        const parent = schemas.get('element:'+qname(current.node,current.node.getAttribute('substitutionGroup')));
        if (!parent || seen.has(parent.node)) break;
        seen.add(parent.node);ancestors.push(parent);
        if (parent.node === head) {
          if (!ancestors.some(ancestor=>substitutionBlocked(ancestor,candidate,depth+1))) return candidate;
          break;
        }
        current = parent;
      }
    }
    throw new Error('WSDL abstract element has no available concrete substitution member.');
  }
  /** @param {any} node @param {any} schema @param {number} depth @returns {string} */
  function sample(node,schema,depth) {
    if(activeElements.has(node)) {
      if(canNil(node))return sampleElement(node,schema,depth,true);
      throw recursiveExpansion;
    }
    activeElements.add(node);
    try { return sampleElement(node,schema,depth); }
    finally { activeElements.delete(node); }
  }
  /** @param {any} node */
  function canNil(node) {
    return ['true','1'].includes(node.getAttribute('nillable')) && !node.hasAttribute('fixed');
  }
  /** @param {any} node @param {any} schema @param {number} depth
   * @param {boolean} [nil] @returns {string} */
  function sampleElement(node,schema,depth,nil=false) {
    enter(depth);
    if (node.hasAttribute('ref')) {
      const found = schemas.get('element:' + qname(node,node.getAttribute('ref')));
      if (!found) throw new Error('Unresolved WSDL element reference.');
      return sample(found.node,found.schema,depth+1);
    }
    if (['true','1'].includes(node.getAttribute('abstract'))) {
      const concrete = concreteElement(node,schema,depth+1);
      return sample(concrete.node,concrete.schema,depth+1);
    }
    const name = node.getAttribute('name');
    if (!name || !/^[A-Za-z_][\w.-]*$/.test(name)) throw new Error('Invalid WSDL element name.');
    const namespace = node.parentNode === schema || (node.getAttribute('form') || schema.getAttribute('elementFormDefault')) === 'qualified'
      ? schema.getAttribute('targetNamespace') || '' : '';
    const elementSchema=schema;
    let tag=name,namespaceAttributes=` xmlns="${escape(namespace)}"`,typeAttributes='';
    let content = '';
    let type = children(node,XSD).find(child => ['complexType','simpleType'].includes(child.localName));
    const declared = node.getAttribute('type');
    if (declared) {
      const key = qname(node,declared);
      if (key.startsWith(XSD+'#')) {
        content = builtinSample(key.slice(XSD.length+1));
      } else {
        const found = schemas.get('complexType:'+key) || schemas.get('simpleType:'+key);
        if (!found) throw new Error('Unresolved WSDL schema type.');
        type = found.node;
        schema = found.schema;
      }
    }
    if (type) {
      if (['true','1'].includes(type.getAttribute('abstract'))) {
        const concrete=concreteType(type,schema,node,elementSchema,depth+1);
        type=concrete.node;schema=concrete.schema;
        const typeName=type.getAttribute('name');
        if(!typeName || !/^[A-Za-z_][\w.-]*$/.test(typeName))throw new Error('Invalid WSDL concrete type name.');
        typeAttributes=' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
        if(concrete.namespace)typeAttributes+=` xmlns:xt="${escape(concrete.namespace)}" xsi:type="xt:${typeName}"`;
        else {
          typeAttributes+=` xsi:type="${typeName}"`;
          if(namespace){tag='e:'+name;namespaceAttributes=` xmlns="" xmlns:e="${escape(namespace)}"`;}
        }
      }
      if(nil) {
        const nilAttributes=(typeAttributes.includes(' xmlns:xsi=') ? ''
          : ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')+' xsi:nil="true"';
        const attributes=type.localName==='complexType' ? attributeXml(attributesFor(type,schema,depth+1)) : '';
        return bounded(`<${tag}${namespaceAttributes}${typeAttributes}${nilAttributes}${attributes}></${tag}>`);
      }
      const members = children(type,XSD).filter(child => child.localName !== 'annotation');
      const restriction = members.find(child => child.localName === 'restriction');
      if (type.localName === 'simpleType' || restriction) {
        content = textValue(type,depth+1);
      } else {
        content = complexFields(type,schema,depth+1);
        const complexContent=children(type,XSD,'complexContent')[0];
        const mixed=['true','1'].includes(complexContent?.hasAttribute('mixed')
          ? complexContent.getAttribute('mixed') : type.getAttribute('mixed'));
        if ((children(type,XSD,'simpleContent').length || (mixed && !content)) &&
            (node.hasAttribute('fixed') || node.hasAttribute('default')))
          content = escape(node.getAttribute('fixed') ?? node.getAttribute('default'));
        const attributes = attributeXml(attributesFor(type,schema,depth+1));
        return bounded(`<${tag}${namespaceAttributes}${typeAttributes}${attributes}>${content}</${tag}>`);
      }
    } else if (!declared) throw new Error('WSDL elements require an explicit supported schema type.');
    return bounded(`<${tag}${namespaceAttributes}${typeAttributes}>${escape(node.getAttribute('fixed') ?? node.getAttribute('default') ?? content)}</${tag}>`);
  }
  /** @param {any} part */
  function literalPart(part) {
    if (!part?.hasAttribute('element') || part.hasAttribute('type'))
      throw new Error('WSDL literal parts must reference schema elements.');
    const found = schemas.get('element:'+qname(part,part.getAttribute('element')));
    if (!found) throw new Error('Unresolved WSDL message element.');
    return sample(found.node,found.schema,0);
  }
  const workspaceId = id('wrk');
  /** @type {Record<string,any>[]} */ const resources = [{_id:workspaceId,_type:'workspace',parentId:null,
    name:root.getAttribute('name') || children(root,WSDL,'service')[0]?.getAttribute('name') || 'WSDL Collection',scope:'collection',_wsdlSource:text,
    ...(bundle.sources.length ? {_wsdlRoot:bundle.name,_wsdlDocuments:bundle.sources} : {})}];
  for (const service of bundle.roots.flatMap(definitionRoot=>children(definitionRoot,WSDL,'service'))) for (const port of children(service,WSDL,'port')) {
    const binding = definition('binding',port,port.getAttribute('binding'));
    const soap = children(binding,SOAP,'binding')[0] || children(binding,SOAP12,'binding')[0];
    const soapNamespace = soap?.namespaceURI || SOAP;
    const address = children(port,soapNamespace,'address')[0];
    if (!soap || !address || soap.getAttribute('transport') !== 'http://schemas.xmlsoap.org/soap/http')
      throw new Error('This WSDL binding is not supported SOAP over HTTP.');
    const endpoint = address.getAttribute('location') || '';
    const url = new URL(endpoint);
    if (!['http:','https:'].includes(url.protocol)) throw new Error('WSDL SOAP addresses must use HTTP(S).');
    const portType = definition('portType',binding,binding.getAttribute('type'));
    const folderId = id('fld');
    resources.push({_id:folderId,_type:'request_group',parentId:workspaceId,name:service.getAttribute('name')+' / '+port.getAttribute('name'),environment:{}});
    for (const operation of children(binding,WSDL,'operation')) {
      if (resources.length >= 10000) throw new Error('WSDL resource limit exceeded.');
      const name = operation.getAttribute('name');
      if (!name || !/^[A-Za-z_][\w.-]*$/.test(name)) throw new Error('Invalid WSDL operation name.');
      const soapOperation = children(operation,soapNamespace,'operation')[0];
      const style = soapOperation?.getAttribute('style') || soap.getAttribute('style') || 'document';
      if (!['document','rpc'].includes(style)) throw new Error('Unsupported WSDL operation style.');
      const abstractOperations = children(portType,WSDL,'operation').filter(item => item.getAttribute('name') === name);
      if (abstractOperations.length !== 1) throw new Error('Ambiguous or unresolved WSDL operation.');
      const abstractInput = children(abstractOperations[0],WSDL,'input')[0];
      const input = children(operation,WSDL,'input')[0];
      const body = children(input,soapNamespace,'body')[0];
      const headers = children(input,soapNamespace,'header');
      if (!abstractInput || !body || (body.getAttribute('use') || 'literal') !== 'literal' || children(input).some(child =>
        child !== body && !headers.includes(child) && !(child.namespaceURI === WSDL && child.localName === 'documentation')))
        throw new Error('WSDL input must use supported SOAP literal body/header bindings.');
      let headerPayload = '';
      for (const header of headers) {
        if ((header.getAttribute('use') || 'literal') !== 'literal')
          throw new Error('WSDL encoded SOAP headers are not yet supported.');
        const headerMessage = definition('message',header,header.getAttribute('message'));
        const headerParts = children(headerMessage,WSDL,'part').filter(part=>part.getAttribute('name') === header.getAttribute('part'));
        if (headerParts.length !== 1) throw new Error('Ambiguous or unresolved WSDL SOAP header part.');
        headerPayload += literalPart(headerParts[0]);
      }
      const message = definition('message',abstractInput,abstractInput.getAttribute('message'));
      const parts = children(message,WSDL,'part');
      /** @type {string[]} */ const selected = body.hasAttribute('parts') ? body.getAttribute('parts').trim().split(/\s+/).filter(Boolean) : parts.map(part=>part.getAttribute('name'));
      if (new Set(parts.map(part=>part.getAttribute('name'))).size !== parts.length || new Set(selected).size !== selected.length)
        throw new Error('Duplicate WSDL message parts.');
      const order = abstractOperations[0].getAttribute('parameterOrder')?.trim().split(/\s+/).filter(Boolean);
      if (style === 'rpc' && order?.length) {
        if (selected.some(part=>!order.includes(part))) throw new Error('WSDL parameterOrder omits an input part.');
        selected.sort((a,b)=>order.indexOf(a)-order.indexOf(b));
      }
      let payload = '';
      for (const partName of selected) {
        const part = parts.find(part=>part.getAttribute('name') === partName);
        if (style === 'rpc') {
          if (!part?.hasAttribute('type') || part.hasAttribute('element'))
            throw new Error('WSDL RPC literal parts must reference schema types.');
          // RPC accessors use part names without a namespace; named complex
          // types still generate their own schema-qualified child elements.
          payload += sample(part,document.createElementNS(XSD,'schema'),0);
          continue;
        }
        payload += literalPart(part);
      }
      if (style === 'rpc') {
        const namespace = body.getAttribute('namespace');
        if (!namespace) throw new Error('WSDL RPC literal bodies require a namespace.');
        payload = bounded(`<rpc:${name} xmlns:rpc="${escape(namespace)}">${payload}</rpc:${name}>`);
      }
      const action = soapOperation?.getAttribute('soapAction') || '';
      const soap12 = soapNamespace === SOAP12;
      const envelope = soap12 ? 'http://www.w3.org/2003/05/soap-envelope' : 'http://schemas.xmlsoap.org/soap/envelope/';
      const mime = soap12 ? 'application/soap+xml' : 'text/xml';
      resources.push(newRequest(folderId,{name,method:'POST',url:endpoint,description:children(abstractOperations[0],WSDL,'documentation')[0]?.textContent?.trim() || '',
        headers:[{name:'Content-Type',value:mime+'; charset=utf-8'+(soap12 && action ? '; action='+JSON.stringify(action) : '')},
          {name:'Accept',value:mime},...(!soap12 ? [{name:'SOAPAction',value:JSON.stringify(action)}] : [])],
        body:{mimeType:'application/xml',text:`<soap:Envelope xmlns:soap="${envelope}">${headers.length ? `<soap:Header>${headerPayload}</soap:Header>` : ''}<soap:Body>${payload}</soap:Body></soap:Envelope>`},
        _wsdlGeneratedExample:true}));
    }
  }
  if (!resources.some(resource => resource._type === 'request')) throw new Error('WSDL contains no supported SOAP operations.');
  return resources;
}
