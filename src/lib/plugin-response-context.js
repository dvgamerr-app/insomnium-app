/** Response namespace embedded in QuickJS. Body access always copies guest bytes.
 * @param {Record<string,any>} response @param {any} Buffer @param {any} Readable */
export function createPluginResponseContext(response, Buffer, Readable) {
  const headers=()=>response.headers??[];
  const bytes=()=>Buffer.from(response.bodyBytes??[]);
  return {
    getRequestId:()=>response.requestId??response.parentId??'',
    getStatusCode:()=>response.status??0,
    getStatusMessage:()=>response.statusText??'',
    getBytesRead:()=>response.size??0,
    getTime:()=>response.elapsedMs??0,
    getBody:bytes,
    setBody:(/** @type {any} */body)=>{
      if(!Buffer.isBuffer(body))throw TypeError('Response body must be a Buffer');
      response.bodyBytes=Uint8Array.from(body);
      response.bytesContent=body.length;
      response.bodyChanged=true;
    },
    getHeader:(/** @type {string} */name)=>{
      const values=headers().filter((/** @type {any} */row)=>String(Array.isArray(row)?row[0]:row.name).toLowerCase()===name.toLowerCase()).map((/** @type {any} */row)=>Array.isArray(row)?row[1]:row.value);
      return values.length>1?values:values.length?values[0]:null;
    },
    getHeaders:()=>headers().map((/** @type {any} */row)=>({name:Array.isArray(row)?row[0]:row.name,value:Array.isArray(row)?row[1]:row.value})),
    hasHeader(/** @type {string} */name){return this.getHeader(name)!==null;},
    getBodyStream:()=>Readable.from([bytes()],{objectMode:false}),
  };
}
