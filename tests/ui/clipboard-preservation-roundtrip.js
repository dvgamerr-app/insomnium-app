import assert from 'node:assert/strict';
import {createClipboardPreserver} from './helpers/clipboard-preservation.js';
const output='artifacts/playwright/clipboard-preservation-roundtrip-'+Date.now(),owner=createClipboardPreserver();
try{
 const snapshot=owner.capture();assert.equal(snapshot.allClonesVerified,true);
 // No owned mutation was made: verify the original synchronously under the
 // exclusive clipboard lock without EmptyClipboard or SetClipboardData.
 const restoration=owner.restore();assert.equal(restoration.restored,true);assert.equal(restoration.bytesVerified,true);assert.equal(restoration.formats,snapshot.formats.length);
 assert.equal(restoration.clipboardMutated,false);
 await Bun.write(output+'/result.json',JSON.stringify({status:'verified-current-format-unchanged',snapshot,restoration,plaintextLogged:false,testValueWritten:false,physicalRoundtripExecuted:false,nativeAppClipboardAccepted:false,supportedFormats:[1,7,13,16],supportedRegisteredFormats:['HTML Format','Chromium internal source RFH token','Chromium internal source URL'],scope:'Exact current complete supported format set and bytes verified unchanged without a clipboard write. Unsupported/changed sets refuse; physical restoration after owned native mutations requires the native event scenario.'},null,2));console.log(JSON.stringify({output,status:'verified-current-format-unchanged',formats:restoration.formats,bytesVerified:true,clipboardMutated:false}));
}finally{owner.dispose();}
