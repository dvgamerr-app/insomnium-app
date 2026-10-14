import assert from 'node:assert/strict';
import {createClipboardPreserver} from './helpers/clipboard-preservation.js';
const output='artifacts/playwright/clipboard-preservation-preflight-'+Date.now(),owner=createClipboardPreserver();
try{const snapshot=owner.capture();assert.equal(snapshot.allClonesVerified,true);assert.equal(snapshot.clipboardMutated,false);await Bun.write(output+'/result.json',JSON.stringify({status:'captured-read-only',...snapshot,restoreExecuted:false,osClipboardAccepted:false},null,2));console.log(JSON.stringify({output,status:'captured-read-only',formats:snapshot.formats.length,totalBytes:snapshot.totalBytes,restoreExecuted:false}));}
finally{owner.dispose();}
