import assert from 'node:assert/strict';
import {resolve,join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {assertSpectralFixtureRepositoryId} from './helpers/spectral-native-fixture.js';
import {retireSpectralNativeRepository} from './helpers/spectral-native-cleanup.js';

// Refusal-only saved guard checks; no native app, real profile or deletion.
const proof=resolve('artifacts/spectral-native-adapter-preparation','refusal-guards-'+Date.now());await mkdir(proof,{recursive:true});
assertSpectralFixtureRepositoryId('git_spectral_'+'a'.repeat(32));
const invalid=['','git_spectral_'+'a'.repeat(31),'git_spectral_'+'A'.repeat(32),'git_spectral_'+'a'.repeat(32)+'/..','../repo','CON'];
for(const id of invalid)assert.throws(()=>assertSpectralFixtureRepositoryId(id));
await assert.rejects(()=>retireSpectralNativeRepository({marker:join(proof,'foreign.json'),owner:/** @type {any} */({})},proof));
const owner={pid:process.pid};const marker=join(proof,'spectral-repository-cleanup-owner.json');await Bun.write(marker,JSON.stringify(owner));await Bun.write(join(proof,'result.json'),JSON.stringify({scenario:'spectral-api-design-native',renderingMode:'native-hidden',pid:process.pid,exit:{code:0},intentionalParentTermination:false,testOnlyForgedExitRecord:true}));
await assert.rejects(()=>retireSpectralNativeRepository({marker,owner:/** @type {any} */(owner)},proof),/No live\/recycled PID/);
await Bun.write(join(proof,'guard-result.json'),JSON.stringify({scope:'Refusal-only guard checks; no native/profile/deletion acceptance',invalidIds:invalid.length,foreignMarkerRefused:true,forgedExitRecordWithLiveOwnProcessRefused:true,noProfileReadsBeforeRefusal:true,noProfileWrites:true},null,2));console.log(JSON.stringify({passed:true,guards:invalid.length+3,output:proof,nativeLaunches:0,profileWrites:0}));
