import assert from "node:assert/strict";

/** Minimal owned fixture encoding for the canonical reflection/descriptor protos. */
/** @param {number} value */
function varint(value) {
  const bytes = [];
  do { const byte = value & 127; value = Math.floor(value / 128); bytes.push(byte | (value ? 128 : 0)); } while (value);
  return Buffer.from(bytes);
}
/** @param {number} field @param {Buffer|string} value */
const bytesField = (field,value) => {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return Buffer.concat([varint(field * 8 + 2),varint(bytes.length),bytes]);
};
/** @param {number} field @param {number} value */
const numberField = (field,value) => Buffer.concat([varint(field * 8),varint(value)]);
const input = Buffer.concat([bytesField(1,"Input"),bytesField(2,Buffer.concat([
  bytesField(1,"name"),numberField(3,1),numberField(4,1),numberField(5,9),
]))]);
const descriptor = Buffer.concat([
  bytesField(1,"owned-reflection.proto"),bytesField(2,"helper"),bytesField(4,input),
  bytesField(6,Buffer.concat([bytesField(1,"Sample"),bytesField(2,Buffer.concat([
    bytesField(1,"Echo"),bytesField(2,".helper.Input"),bytesField(3,".helper.Input"),
  ]))])),bytesField(12,"proto3"),
]);
/** @param {Buffer} payload */
function requestFields(payload) {
  let offset = 0;
  const read = () => {
    let value = 0;
    for (let shift=0;shift<35;shift+=7) {
      assert.ok(offset<payload.length,"Truncated owned reflection varint");
      const byte=payload[offset++];value+=(byte&127)*2**shift;
      if (!(byte&128)) return value;
    }
    throw Error("Oversized owned reflection varint");
  };
  const fields = [];
  while (offset<payload.length) {
    const tag=read();assert.equal(tag&7,2);
    const length=read();assert.ok(offset+length<=payload.length);
    fields.push({field:tag>>>3,value:payload.subarray(offset,offset+length).toString()});offset+=length;
  }
  return fields;
}
/** @param {import('node:http2').ServerHttp2Stream} stream
 * @param {import('node:http2').IncomingHttpHeaders} headers
 * @param {any[]} records @param {string[]} errors */
export function handleGrpcReflection(stream,headers,records,errors) {
  const path=String(headers[":path"]);
  if(path!=="/grpc.reflection.v1.ServerReflection/ServerReflectionInfo")return false;
  const row={path,metadata:headers["owned-helper"]??null,queries:/** @type {any[]} */([]),closed:false,rstCode:0};
  records.push(row);
  stream.respond({":status":200,"content-type":"application/grpc"},{waitForTrailers:true});
  stream.on("wantTrailers",()=>stream.sendTrailers({"grpc-status":"0"}));
  stream.on("error",error=>{if(stream.rstCode!==8)errors.push(String(error));});
  stream.on("close",()=>{row.closed=true;row.rstCode=stream.rstCode;});
  let bytes=Buffer.alloc(0);
  stream.on("data",chunk=>{
    bytes=Buffer.concat([bytes,Buffer.from(chunk)]);
    while(bytes.length>=5&&bytes.length>=5+bytes.readUInt32BE(1)){
      assert.equal(bytes[0],0);
      const length=bytes.readUInt32BE(1),payload=bytes.subarray(5,5+length);
      const query=requestFields(payload).find(row=>row.field===7||row.field===4);
      assert.ok(query,"Unexpected owned reflection query");
      row.queries.push({kind:query.field===7?"list-services":"file-containing-symbol",value:query.value});
      if(query.field===4)assert.equal(query.value,"helper.Sample");
      const answer=query.field===7?bytesField(6,bytesField(1,bytesField(1,"helper.Sample"))):bytesField(4,bytesField(1,descriptor));
      const reply=Buffer.concat([bytesField(2,payload),answer]),frame=Buffer.alloc(5);
      frame.writeUInt32BE(reply.length,1);stream.write(Buffer.concat([frame,reply]));
      bytes=bytes.subarray(5+length);
    }
  });
  stream.on("end",()=>{assert.equal(bytes.length,0);if(!stream.destroyed)stream.end();});
  return true;
}
