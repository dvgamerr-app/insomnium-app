import { mkdir, readdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dir, '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const posix = path => path.replaceAll('\\', '/');
const recoveredRuntime = {
  id: '@stoplight/spectral-runtime@1.1.6',
  gitHead: 'a06d7b8f878d578bb37189ba76b1d1e136608e4d',
  integrity: 'sha512-Y8rEDyMN4bSMJCrDs2shdcVHYyCnH3FvXRP4dBhha4Z8iJv+JPp7KqOV/hwVB/hWFC209upiwj2oDmLfR0qCDg==',
  sha256: 'd45c17f7ecc80e0deab3372ff352c7d00b7d573755c3c672088c21a376673698',
  packageJSONSHA256: 'b2e2446abb1ee3987c1433fec7dc3976a2b7ccdb3ac791d61bc4d3e7c15bb74a',
  metadataSource: 'https://registry.npmjs.org/%40stoplight%2Fspectral-runtime/1.1.6',
  tarballSource: 'https://registry.npmjs.org/@stoplight/spectral-runtime/-/spectral-runtime-1.1.6.tgz',
  tarballSHA256: '9e60c71278b8792f4357f53c7f6ca51d0fd8a5b834bde3bfb9c3dca8f3b9e257',
};
const runtimeSourceIdentity = { version: '1.4.2', revision: '744846f844374847c902b5e7fd59b4342a51ef99' };
const runtimeSourceCandidates = [
  { component: 'libarchive distribution COPYING', sourcePin: 'ded82291ab41d5e355831b96b0e1ff49e24d8939', declaredBuildCondition: 'Pinned Bun dependency lists libarchive C inputs on supported targets; linked objects and per-file license coverage unproven', origins: ['https://raw.githubusercontent.com/libarchive/libarchive/ded82291ab41d5e355831b96b0e1ff49e24d8939/COPYING'], path: 'tools/spectral-linter/notice-sources/libarchive-ded822-COPYING', bytes: 3089, sha256: '30e556b3959e3985d66efefec5eaac51d4995053caa1d3cffe6eb916f146f229' },
  { component: 'libuv', sourcePin: '8023581113b276e7c1aee3f82da57ca0893faab1', declaredBuildCondition: 'Bun dependency enabled when cfg.windows; header version 1.51.1', origins: ['https://raw.githubusercontent.com/oven-sh/libuv/8023581113b276e7c1aee3f82da57ca0893faab1/LICENSE'], path: 'tools/spectral-linter/notice-sources/libuv-802358-LICENSE', bytes: 1079, sha256: '16de0c32b265cb7d46a6d3bd614f259dd4d693a5e26b3407b04aae8d73041f0c' },
  { component: 'Bun-vendored uSockets and uWS', sourcePin: runtimeSourceIdentity.revision, declaredBuildCondition: 'Bun source glob includes vendored uSockets; uWS inventory source text at the same Bun revision', origins: ['https://raw.githubusercontent.com/oven-sh/bun/744846f844374847c902b5e7fd59b4342a51ef99/packages/bun-usockets/LICENSE', 'https://raw.githubusercontent.com/oven-sh/bun/744846f844374847c902b5e7fd59b4342a51ef99/packages/bun-uws/LICENSE'], path: 'tools/spectral-linter/notice-sources/bun-744846-uSockets-uWS-LICENSE', bytes: 11357, sha256: 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4' },
  { component: 'JavaScriptCore COPYING.LIB', sourcePin: '2e2aa2290fac856d6f451ceacb58f7f5b44dd057', declaredBuildCondition: 'Bun default WebKit source pin; prebuilt variant and linked objects unproven', origins: ['https://raw.githubusercontent.com/oven-sh/WebKit/2e2aa2290fac856d6f451ceacb58f7f5b44dd057/Source/JavaScriptCore/COPYING.LIB'], path: 'tools/spectral-linter/notice-sources/jsc-2e2aa-COPYING.LIB', bytes: 25584, sha256: '5094ecb9c9dcd0eadc34f3c11511d9b5535063032bc150164ecd1a5d5a445547' },
  { component: 'ICU root LICENSE', sourcePin: '21d1eb0f306e1141c10931e914dfc038c06121da', declaredBuildCondition: 'Pinned WebKit Windows build script references ICU 78.3; release-78.3 resolves this revision; icu4c/LICENSE resolves ../LICENSE', origins: ['https://raw.githubusercontent.com/unicode-org/icu/21d1eb0f306e1141c10931e914dfc038c06121da/LICENSE'], path: 'tools/spectral-linter/notice-sources/icu-21d1eb-LICENSE', bytes: 27718, sha256: 'e55522d81edc687a341a4411e0776e54ca654e90147f354a90458aaced4116af' },
  {"component":"libdeflate COPYING","sourcePin":"c8c56a20f8f621e6a966b716b31f1dedab6a41e3","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file license coverage unproven","origins":["https://raw.githubusercontent.com/ebiggers/libdeflate/c8c56a20f8f621e6a966b716b31f1dedab6a41e3/COPYING"],"path":"tools/spectral-linter/notice-sources/libdeflate-c8c56a-COPYING","bytes":1078,"sha256":"4ad69099cb4374836fd27583d9991e2838cd86b6e4666ab26b2d32582c91e73a"},
  {"component":"libspng LICENSE","sourcePin":"fb768002d4288590083a476af628e51c3f1d47cd","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file license coverage unproven","origins":["https://raw.githubusercontent.com/randy408/libspng/fb768002d4288590083a476af628e51c3f1d47cd/LICENSE"],"path":"tools/spectral-linter/notice-sources/libspng-fb7680-LICENSE","bytes":1341,"sha256":"0622b0794d0fecde47d743f1bb70a03e6fdf082be8e71f39de672ed995d96ff9"},
  {"component":"libjpeg-turbo LICENSE.md","sourcePin":"e352b02f794f701407b39af08576035ba3360d60","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file license coverage unproven","origins":["https://raw.githubusercontent.com/libjpeg-turbo/libjpeg-turbo/e352b02f794f701407b39af08576035ba3360d60/LICENSE.md"],"path":"tools/spectral-linter/notice-sources/libjpeg-turbo-e352b0-LICENSE.md","bytes":5622,"sha256":"e10114e6e40f3d0311c401ca25245ac5ef459a43c20f976fd63f03e816f5741f"},
  {"component":"libjpeg-turbo README.ijg","sourcePin":"e352b02f794f701407b39af08576035ba3360d60","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file license coverage unproven","origins":["https://raw.githubusercontent.com/libjpeg-turbo/libjpeg-turbo/e352b02f794f701407b39af08576035ba3360d60/README.ijg"],"path":"tools/spectral-linter/notice-sources/libjpeg-turbo-e352b0-README.ijg","bytes":12799,"sha256":"75815e3bf6484201a3c3d17a1bbf10f2e8e3237f84df10a2357ea896db2a81d6"},
  {"component":"libwebp COPYING","sourcePin":"b7e29b9d75bd31422b00c2a446d49d7af06c328d","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file license coverage unproven; Gitiles base64 source transport decoded without normalization","origins":["https://chromium.googlesource.com/webm/libwebp/+/b7e29b9d75bd31422b00c2a446d49d7af06c328d/COPYING?format=TEXT"],"path":"tools/spectral-linter/notice-sources/libwebp-b7e29b-COPYING","bytes":1496,"sha256":"5aec868f669e384a22372a4e8a1a6cd7d44c64cd451f960ca69cc170d1e13acf"},
  {"component":"libwebp PATENTS","sourcePin":"b7e29b9d75bd31422b00c2a446d49d7af06c328d","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file license coverage unproven; Gitiles base64 source transport decoded without normalization","origins":["https://chromium.googlesource.com/webm/libwebp/+/b7e29b9d75bd31422b00c2a446d49d7af06c328d/PATENTS?format=TEXT"],"path":"tools/spectral-linter/notice-sources/libwebp-b7e29b-PATENTS","bytes":1436,"sha256":"cc3273e0694ea5896145e0677699b53471b03ea43021ddc50e7923fbb9f5023c"},
  {"component":"boringssl AUTHORS","sourcePin":"41bf9b59c2ebf277a7aa427e1ecad5cc80dd4d4f","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/oven-sh/boringssl/41bf9b59c2ebf277a7aa427e1ecad5cc80dd4d4f/AUTHORS"],"path":"tools/spectral-linter/notice-sources/boringssl-41bf9b-AUTHORS","bytes":1208,"sha256":"6e5283f25977ae2fbbf5fd8a840b7184b2b48915279c10bf01107263d3f26936"},
  {"component":"boringssl LICENSE","sourcePin":"41bf9b59c2ebf277a7aa427e1ecad5cc80dd4d4f","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/oven-sh/boringssl/41bf9b59c2ebf277a7aa427e1ecad5cc80dd4d4f/LICENSE"],"path":"tools/spectral-linter/notice-sources/boringssl-41bf9b-LICENSE","bytes":13115,"sha256":"827c8d8fc207c2392794eef9e00fe246f9f61fdcc132556c275be3dd8c3cd97f"},
  {"component":"brotli LICENSE","sourcePin":"ed738e842d2fbdf2d6459e39267a633c4a9b2f5d","declaredBuildCondition":"Pinned Bun dependency source declaration; declared v1.1.0 resolved to this commit; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/google/brotli/ed738e842d2fbdf2d6459e39267a633c4a9b2f5d/LICENSE"],"path":"tools/spectral-linter/notice-sources/brotli-ed738e-LICENSE","bytes":1084,"sha256":"3d180008e36922a4e8daec11c34c7af264fed5962d07924aea928c38e8663c94"},
  {"component":"cares AUTHORS","sourcePin":"c7a3138dcfe3bb0eaaf10c0c24c36dc66dc790ab","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/c-ares/c-ares/c7a3138dcfe3bb0eaaf10c0c24c36dc66dc790ab/AUTHORS"],"path":"tools/spectral-linter/notice-sources/cares-c7a313-AUTHORS","bytes":1258,"sha256":"10274d04e1aa59b340e84dbef26550bfc9827fc70908f78bfa755e1a8729939b"},
  {"component":"cares LICENSE.md","sourcePin":"c7a3138dcfe3bb0eaaf10c0c24c36dc66dc790ab","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/c-ares/c-ares/c7a3138dcfe3bb0eaaf10c0c24c36dc66dc790ab/LICENSE.md"],"path":"tools/spectral-linter/notice-sources/cares-c7a313-LICENSE.md","bytes":1211,"sha256":"460f5e768fda3752ca2169a95df062578a10fb126bfd65f3b9b1a1bed2f84807"},
  {"component":"hdrhistogram COPYING.txt","sourcePin":"be60a9987ee48d0abf0d7b6a175bad8d6c1585d1","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/HdrHistogram/HdrHistogram_c/be60a9987ee48d0abf0d7b6a175bad8d6c1585d1/COPYING.txt"],"path":"tools/spectral-linter/notice-sources/hdrhistogram-be60a9-COPYING.txt","bytes":7048,"sha256":"a2010f343487d3f7618affe54f789f5487602331c0a8d03f49e9a7c547cf0499"},
  {"component":"hdrhistogram LICENSE.txt","sourcePin":"be60a9987ee48d0abf0d7b6a175bad8d6c1585d1","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/HdrHistogram/HdrHistogram_c/be60a9987ee48d0abf0d7b6a175bad8d6c1585d1/LICENSE.txt"],"path":"tools/spectral-linter/notice-sources/hdrhistogram-be60a9-LICENSE.txt","bytes":2208,"sha256":"93a583ec58cd981232ec6fab797ff6f17f350c97b83ae0700b2d9350c91028af"},
  {"component":"highway LICENSE","sourcePin":"2607d3b5b0113992fe84d3848859eae13b3b52c1","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/google/highway/2607d3b5b0113992fe84d3848859eae13b3b52c1/LICENSE"],"path":"tools/spectral-linter/notice-sources/highway-2607d3-LICENSE","bytes":20785,"sha256":"e340270d4f64384569a91d546acb5b094d69ce47f0c015db77abb74dc6f815af"},
  {"component":"lolhtml LICENSE","sourcePin":"725ce499aa9b71e38b7a2d0a9fbb6d7294a4079e","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/oven-sh/lol-html/725ce499aa9b71e38b7a2d0a9fbb6d7294a4079e/LICENSE"],"path":"tools/spectral-linter/notice-sources/lolhtml-725ce4-LICENSE","bytes":1487,"sha256":"e4ddaa9d7391bb9536fcb8c59b570a8b85a0bf6da54df5b3b26f098f6f99c9cc"},
  {"component":"lshpack LICENSE","sourcePin":"8905c024b6d052f083a3d11d0a169b3c2735c8a1","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/litespeedtech/ls-hpack/8905c024b6d052f083a3d11d0a169b3c2735c8a1/LICENSE"],"path":"tools/spectral-linter/notice-sources/lshpack-8905c0-LICENSE","bytes":1090,"sha256":"0490f9666828ad1b6b5503102e7ebbe491451b7174511f3b6255caa967caf955"},
  {"component":"lsqpack LICENSE","sourcePin":"1e9c5b8e59f8161c54f168a570c8bfdc59ded0c3","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/litespeedtech/ls-qpack/1e9c5b8e59f8161c54f168a570c8bfdc59ded0c3/LICENSE"],"path":"tools/spectral-linter/notice-sources/lsqpack-1e9c5b-LICENSE","bytes":1090,"sha256":"6b1aded50331e34502c8d2b00238c6146b1a54314ce94a5c5feb5d340a6d00d6"},
  {"component":"lsquic LICENSE","sourcePin":"3181911301b1aa4f54c1ed690901abc674ee08fb","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/litespeedtech/lsquic/3181911301b1aa4f54c1ed690901abc674ee08fb/LICENSE"],"path":"tools/spectral-linter/notice-sources/lsquic-318191-LICENSE","bytes":1090,"sha256":"9bc22643b3ea2b55c547c83e332253d04ba3df4f26696091e6fa9f7a1ccc65ef"},
  {"component":"lsquic LICENSE.chrome","sourcePin":"3181911301b1aa4f54c1ed690901abc674ee08fb","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/litespeedtech/lsquic/3181911301b1aa4f54c1ed690901abc674ee08fb/LICENSE.chrome"],"path":"tools/spectral-linter/notice-sources/lsquic-318191-LICENSE.chrome","bytes":1618,"sha256":"85d5dcb0d30ea89fa5922451957ff2a1a2c3c24f1ad2bb9ab23b5d6080763fc9"},
  {"component":"mimalloc LICENSE","sourcePin":"6a64e1ba7f5b2130d4efccb67ec87fd0003f0f6a","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/oven-sh/mimalloc/6a64e1ba7f5b2130d4efccb67ec87fd0003f0f6a/LICENSE"],"path":"tools/spectral-linter/notice-sources/mimalloc-6a64e1-LICENSE","bytes":1096,"sha256":"82ade5d7d9b029044b5fbbc326207fc47c2d44ee4dd71e8a559c36d728217de9"},
  {"component":"rust-argon2 LICENSE-APACHE","sourcePin":"ed81866f163f0c7026aa6fd8388adf37242eb32a","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/sru-systems/rust-argon2/ed81866f163f0c7026aa6fd8388adf37242eb32a/LICENSE-APACHE"],"path":"tools/spectral-linter/notice-sources/rust-argon2-ed8186-LICENSE-APACHE","bytes":10847,"sha256":"a60eea817514531668d7e00765731449fe14d059d3249e0bc93b36de45f759f2"},
  {"component":"rust-argon2 LICENSE-MIT","sourcePin":"ed81866f163f0c7026aa6fd8388adf37242eb32a","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/sru-systems/rust-argon2/ed81866f163f0c7026aa6fd8388adf37242eb32a/LICENSE-MIT"],"path":"tools/spectral-linter/notice-sources/rust-argon2-ed8186-LICENSE-MIT","bytes":1101,"sha256":"26b997d1a1496df49cb1ad2cbe024714cd9126543c18e1bc6c7bbca1b3dc42b6"},
  {"component":"tinycc COPYING","sourcePin":"05f0fafaa3be31e31d7b4b5c17dc60f62c991171","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/oven-sh/tinycc/05f0fafaa3be31e31d7b4b5c17dc60f62c991171/COPYING"],"path":"tools/spectral-linter/notice-sources/tinycc-05f0fa-COPYING","bytes":26428,"sha256":"512d2d21b6b3384ba64781abb0208a1b87740bc31e2df48e2b206ddb7e4d5779"},
  {"component":"zlib LICENSE.md","sourcePin":"12731092979c6d07f42da27da673a9f6c7b13586","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/zlib-ng/zlib-ng/12731092979c6d07f42da27da673a9f6c7b13586/LICENSE.md"],"path":"tools/spectral-linter/notice-sources/zlib-127310-LICENSE.md","bytes":867,"sha256":"6c9f0d975b41afaa34d22f55bb8986ce69e5cb7ad327cb2b28820cd425edf5ee"},
  {"component":"zstd COPYING","sourcePin":"f8745da6ff1ad1e7bab384bd1f9d742439278e99","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/facebook/zstd/f8745da6ff1ad1e7bab384bd1f9d742439278e99/COPYING"],"path":"tools/spectral-linter/notice-sources/zstd-f8745d-COPYING","bytes":18091,"sha256":"f9c375a1be4a41f7b70301dd83c91cb89e41567478859b77eef375a52d782505"},
  {"component":"zstd LICENSE","sourcePin":"f8745da6ff1ad1e7bab384bd1f9d742439278e99","declaredBuildCondition":"Pinned Bun dependency source declaration; linked objects, patch and per-file coverage unproven","origins":["https://raw.githubusercontent.com/facebook/zstd/f8745da6ff1ad1e7bab384bd1f9d742439278e99/LICENSE"],"path":"tools/spectral-linter/notice-sources/zstd-f8745d-LICENSE","bytes":1549,"sha256":"7055266497633c9025b777c78eb7235af13922117480ed5c674677adc381c9d8"},
  {"component":"picohttpparser C/header license comment","sourcePin":"066d2b1e9ab820703db0837a7255d92d30f0c9f5","declaredBuildCondition":"Bun directly compiles picohttpparser.c; exact identical leading license comment bytes [0,1291) from picohttpparser.c and picohttpparser.h; linked objects and other per-file coverage unproven","origins":["https://raw.githubusercontent.com/h2o/picohttpparser/066d2b1e9ab820703db0837a7255d92d30f0c9f5/picohttpparser.c","https://raw.githubusercontent.com/h2o/picohttpparser/066d2b1e9ab820703db0837a7255d92d30f0c9f5/picohttpparser.h"],"path":"tools/spectral-linter/notice-sources/picohttpparser-066d2b-NOTICE","bytes":1291,"sha256":"38a1881166cfd8b7e727bb1ad96996f7e96ce726ae4cea1dddf5d531503341d0"},
  {"component":"Node.js headers source LICENSE","sourcePin":"b7e6a5d37e7a14ef0f2cc95214b95d66c4081415","declaredBuildCondition":"Bun default Node.js 26.3.0 header-only input; three official archive headers match this release source; no Node runtime; build variant and linked component coverage unproven","origins":["https://raw.githubusercontent.com/nodejs/node/b7e6a5d37e7a14ef0f2cc95214b95d66c4081415/LICENSE"],"path":"tools/spectral-linter/notice-sources/node-headers-b7e6a5-LICENSE","bytes":157606,"sha256":"148eacf7863ef4329224a29398623077200a27194aa075569faf4a0a85566ca5"},
  {"component":"Bun-vendored SQLite c source notice","sourcePin":"744846f844374847c902b5e7fd59b4342a51ef99","declaredBuildCondition":"Bun staticSqlite input (Linux/Windows default); exact source comment bytes [1657,2083); macOS system library, other per-file and linked coverage unproven","origins":["https://raw.githubusercontent.com/oven-sh/bun/744846f844374847c902b5e7fd59b4342a51ef99/src/jsc/bindings/sqlite/sqlite3.c"],"path":"tools/spectral-linter/notice-sources/sqlite-744846-c-NOTICE","bytes":426,"sha256":"39fc4986b224f2f5575dec58ae66c7c9ee2d5d3884ba4971c932f1fd5b40b033"},
  {"component":"Bun-vendored SQLite header source notice","sourcePin":"744846f844374847c902b5e7fd59b4342a51ef99","declaredBuildCondition":"Bun staticSqlite input (Linux/Windows default); exact source comment bytes [20,1504); macOS system library, other per-file and linked coverage unproven","origins":["https://raw.githubusercontent.com/oven-sh/bun/744846f844374847c902b5e7fd59b4342a51ef99/src/jsc/bindings/sqlite/sqlite3_local.h"],"path":"tools/spectral-linter/notice-sources/sqlite-744846-header-NOTICE","bytes":1484,"sha256":"cc65d76f325d884dd49e319acf3764d5513920f34ad18e34347b8dedc6ddd2ec"},
];
export async function parseNoticeLock(text, projectRoot = root) {
  const { parse } = await import(pathToFileURL(resolve(projectRoot, 'tools/spectral-linter/node_modules/jsonc-parser/lib/umd/main.js')).href);
  const errors = [], lock = parse(text, errors, { allowTrailingComma: true });
  if (errors.length || lock?.lockfileVersion !== 2 || !lock.packages || typeof lock.packages !== 'object' || Array.isArray(lock.packages)) throw Error('Malformed Spectral Bun lock');
  const identities = new Map();
  for (const key of Object.keys(lock.packages).sort(order)) {
    const entry = lock.packages[key];
    if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !/^(@[^/@]+\/)?[^/@]+@[^/@]+$/.test(entry[0]) || typeof entry[3] !== 'string' || !entry[3].startsWith('sha512-')) throw Error('Malformed Spectral lock package: ' + key);
    const row = identities.get(entry[0]) ?? { id: entry[0], integrity: entry[3], lockKeys: [] };
    if (row.integrity !== entry[3]) throw Error('Conflicting lock identity: ' + entry[0]);
    row.lockKeys.push(key); identities.set(row.id, row);
  }
  return [...identities.values()].sort((a, b) => order(a.id, b.id));
}

export async function collectSpectralNotices(projectRoot = root) {
  const inputs = new Map(), chunks = [Buffer.from('Spectral producer notice inventory. Coverage is incomplete; this is not a legal-compliance assertion.\n')];
  async function bytes(path) { const data = await Bun.file(resolve(projectRoot, path)).bytes(); inputs.set(posix(path), { path: posix(path), bytes: data.length, sha256: hash(data) }); return data; }
  const parserRoot = 'tools/spectral-linter/node_modules/jsonc-parser';
  const parser = JSON.parse(Buffer.from(await bytes(parserRoot + '/package.json')).toString());
  if (parser.version !== '2.2.1') throw Error('Expected pinned jsonc-parser 2.2.1');
  for (const file of ['main.js', 'impl/edit.js', 'impl/format.js', 'impl/parser.js', 'impl/scanner.js']) await bytes(parserRoot + '/lib/umd/' + file);
  const locked = await parseNoticeLock(Buffer.from(await bytes('tools/spectral-linter/bun.lock')).toString(), projectRoot);
  const sources = JSON.parse(Buffer.from(await bytes('tools/spectral-linter/notice-sources.json')).toString());
  if (sources.schemaVersion !== 1 || sources.bun?.version !== Bun.version || sources.bun.version !== '1.4.2') throw Error('Spectral runtime notice version mismatch');
  const recovered = sources.recoveredPackage;
  const sourceRoot = 'https://raw.githubusercontent.com/stoplightio/spectral/' + recoveredRuntime.gitHead + '/';
  if (!recovered || Object.entries(recoveredRuntime).some(([key, value]) => recovered[key] !== value) || recovered.kind !== 'repository-license-at-published-commit' || recovered.source !== sourceRoot + 'LICENSE' || recovered.packageJSONSource !== sourceRoot + 'packages/runtime/package.json' || recovered.path !== 'tools/spectral-linter/notice-sources/spectral-runtime-1.1.6-repository-LICENSE' || recovered.packageJSONPath !== 'tools/spectral-linter/notice-sources/spectral-runtime-1.1.6-package.json') throw Error('Recovered Spectral notice provenance mismatch');
  await bytes('scripts/generate-spectral-notices.mjs');
  const resolverPatch = {
    id: '@stoplight/json-ref-resolver@3.1.6',
    path: 'tools/spectral-linter/patches/@stoplight%2Fjson-ref-resolver@3.1.6.patch',
    modifiedFiles: ['runner.js', 'crawler.js'],
    changes: 'Insomnium modifies fragment resolution to retain pristine cached sources, resolve hidden lexical targets and their dependencies, and preserve authored graph/source paths.',
  };
  const producerPackage = JSON.parse(Buffer.from(await bytes('tools/spectral-linter/package.json')).toString());
  if (producerPackage.patchedDependencies?.[resolverPatch.id] !== resolverPatch.path.slice('tools/spectral-linter/'.length)) throw Error('Resolver patch declaration mismatch');
  await bytes(resolverPatch.path);
  for (const file of resolverPatch.modifiedFiles) await bytes('tools/spectral-linter/node_modules/@stoplight/json-ref-resolver/' + file);
  chunks.push(Buffer.from('\nModified dependency: ' + resolverPatch.id + ' (Apache-2.0). Modified files: ' + resolverPatch.modifiedFiles.join(', ') + '.\n' + resolverPatch.changes + '\nPatch: ' + resolverPatch.path + '\n'));
  const installed = new Map();
  async function modules(dir) {
    for (const item of (await readdir(resolve(projectRoot, dir), { withFileTypes: true })).sort((a, b) => order(a.name, b.name))) {
      if (item.name.startsWith('.')) continue;
      const path = posix(join(dir, item.name));
      if (item.name.startsWith('@')) { await modules(path); continue; }
      const file = Bun.file(resolve(projectRoot, path, 'package.json'));
      if (!(await file.exists())) continue;
      const meta = await file.json(), id = meta.name + '@' + meta.version;
      if (locked.some(row => row.id === id)) {
        const rows = installed.get(id) ?? []; rows.push({ path, meta }); installed.set(id, rows);
        await bytes(path + '/package.json');
      }
      try { await readdir(resolve(projectRoot, path, 'node_modules')); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      await modules(path + '/node_modules');
    }
  }
  await modules('tools/spectral-linter/node_modules');
  async function licenseFiles(dir) {
    const files = [];
    for (const item of (await readdir(resolve(projectRoot, dir), { withFileTypes: true })).sort((a, b) => order(a.name, b.name))) {
      if (['node_modules', '.git'].includes(item.name)) continue;
      const path = posix(join(dir, item.name));
      if (item.isDirectory()) files.push(...await licenseFiles(path));
      else if (/^(licen[cs]e|notice|copying|copyright)(?:$|[._-])/i.test(item.name) && !/\.json$/i.test(item.name)) files.push(path);
    }
    return files;
  }
  const packages = [];
  for (const row of locked) {
    const copies = installed.get(row.id) ?? [];
    if (!copies.length) {
      if (row.id !== 'fsevents@2.3.3') throw Error('Pinned Spectral package absent or version mismatched: ' + row.id);
      packages.push({ ...row, state: 'absent-optional-external', fullTextAvailable: false, files: [], reason: 'Producer explicitly externalizes fsevents; not installed on this build host.' }); continue;
    }
    const license = copies[0].meta.license ?? copies[0].meta.licenses ?? null;
    if (copies.some(x => JSON.stringify(x.meta.license ?? x.meta.licenses ?? null) !== JSON.stringify(license))) throw Error('Conflicting installed license metadata: ' + row.id);
    const files = [], emitted = new Set();
    for (const copy of copies.sort((a, b) => order(a.path, b.path))) for (const path of await licenseFiles(copy.path)) {
      const data = await bytes(path), sha256 = hash(data);
      if (!data.length) throw Error('Empty Spectral notice source: ' + path);
      files.push({ path, bytes: data.length, sha256 });
      if (!emitted.has(sha256)) { chunks.push(Buffer.from('\n=== ' + row.id + ' / ' + posix(relative(copy.path, path)) + ' ===\n'), Buffer.from(data), Buffer.from('\n')); emitted.add(sha256); }
    }
    if (row.id === recovered.id) {
      const evidence = await bytes(recovered.packageJSONPath), data = await bytes(recovered.path), metadata = JSON.parse(Buffer.from(evidence).toString());
      if (row.integrity !== recovered.integrity || hash(evidence) !== recovered.packageJSONSHA256 || metadata.name + '@' + metadata.version !== row.id || metadata.license !== license || copies.some(copy => inputs.get(copy.path + '/package.json').sha256 !== recovered.packageJSONSHA256) || hash(data) !== recovered.sha256) throw Error('Recovered Spectral notice content/version mismatch');
      files.push({ path: recovered.path, bytes: data.length, sha256: hash(data), provenance: recovered });
      chunks.push(Buffer.from('\n=== ' + row.id + ' / repository LICENSE at published commit ' + recovered.gitHead + ' (not npm-packaged license) ===\n'), Buffer.from(data), Buffer.from('\n'));
    }
    packages.push({ ...row, state: 'installed', license, installPaths: copies.map(x => x.path), fullTextAvailable: files.length > 0, files, ...(files.length ? {} : { reason: 'Published installed package has no full LICENSE/NOTICE/COPYING file; metadata alone is not license text.' }) });
  }
  // Static validators are generated from root-workspace packages rather than
  // the Spectral workspace lock. Keep their attribution with the sidecar too.
  await bytes('bun.lock');
  const generatedValidatorPackages = [];
  for (const name of ['@scalar/openapi-validator','ajv','ajv-draft-04','ajv-formats']) {
    const dir = 'node_modules/' + name;
    const meta = JSON.parse(Buffer.from(await bytes(dir + '/package.json')).toString());
    if (meta.name !== name || meta.license !== 'MIT') throw Error('Generated validator notice metadata changed: ' + name);
    const files = [];
    for (const path of await licenseFiles(dir)) {
      const data = await bytes(path);
      if (!data.length) throw Error('Empty generated validator notice: ' + path);
      files.push({path,bytes:data.length,sha256:hash(data)});
      chunks.push(Buffer.from('\n=== Generated OpenAPI validator: ' + name + '@' + meta.version + ' ===\n'),Buffer.from(data),Buffer.from('\n'));
    }
    if (!files.length) throw Error('Generated validator license text absent: ' + name);
    generatedValidatorPackages.push({id:name+'@'+meta.version,license:meta.license,files});
  }
  const runtimeData = await bytes(sources.bun.path);
  if (hash(runtimeData) !== sources.bun.sha256) throw Error('Pinned Bun notice hash mismatch');
  chunks.push(Buffer.from('\n=== Bun ' + sources.bun.version + ' upstream LICENSE.md ===\n'), Buffer.from(runtimeData), Buffer.from('\n'));
  const sourceTexts = JSON.parse(Buffer.from(await bytes('tools/spectral-linter/runtime-source-texts.json')).toString());
  if (Object.keys(sourceTexts).sort().join(',') !== ['schemaVersion', 'evidenceClass', 'embeddedComponentCoverage', 'bun', 'candidates'].sort().join(',') || sourceTexts.schemaVersion !== 1 || sourceTexts.evidenceClass !== 'source-build-candidate' || sourceTexts.embeddedComponentCoverage !== 'unproven' || JSON.stringify(sourceTexts.bun) !== JSON.stringify(runtimeSourceIdentity) || JSON.stringify(sourceTexts.candidates) !== JSON.stringify(runtimeSourceCandidates) || Bun.version !== runtimeSourceIdentity.version || Bun.revision !== runtimeSourceIdentity.revision) throw Error('Bun source-text candidate provenance mismatch');
  const emittedRuntimeTexts = new Set();
  for (const candidate of sourceTexts.candidates) {
    const data = await bytes(candidate.path);
    if (data.length !== candidate.bytes || hash(data) !== candidate.sha256) throw Error('Bun source-text candidate content mismatch: ' + candidate.component);
    if (!emittedRuntimeTexts.has(candidate.sha256)) {
      chunks.push(Buffer.from('\n=== Bun runtime source candidate: ' + candidate.component + ' (embedded component coverage unproven) ===\n'), Buffer.from(data), Buffer.from('\n'));
      emittedRuntimeTexts.add(candidate.sha256);
    }
  }
  const inventory = { patchedDependencies: [resolverPatch], generatedValidatorPackages, schemaVersion: 1, coverage: 'incomplete', completenessBlocksBuild: false, lockIdentities: locked.length, installedIdentities: packages.filter(x => x.state === 'installed').length, packages, runtime: { ...sources.bun, coverage: 'incomplete', reason: 'Pinned upstream LICENSE.md inventories linked libraries/polyfills; their full texts and redistribution acceptance remain unverified.' }, runtimeSourceTexts: sourceTexts, sourceInputs: [...inputs.values()].sort((a, b) => order(a.path, b.path)) };
  const output = 'src-tauri/notices/spectral/';
  return { inventory, assets: [{ path: output + 'THIRD_PARTY_NOTICES.txt', data: Buffer.concat(chunks) }, { path: output + 'inventory.json', data: Buffer.from(JSON.stringify(inventory, null, 2) + '\n') }] };
}

export async function generateSpectralNotices(projectRoot = root) {
  const collected = await collectSpectralNotices(projectRoot);
  await mkdir(resolve(projectRoot, 'src-tauri/notices/spectral'), { recursive: true });
  for (const asset of collected.assets) await Bun.write(resolve(projectRoot, asset.path), asset.data);
  return collected.inventory;
}
export async function spectralNoticeIdentity(projectRoot = root) {
  const { assets, inventory } = await collectSpectralNotices(projectRoot);
  const outputs = [];
  for (const asset of assets) {
    const data = await Bun.file(resolve(projectRoot, asset.path)).bytes();
    if (hash(data) !== hash(asset.data)) throw Error('Spectral notices are stale or changed: ' + asset.path);
    outputs.push({ path: asset.path, bytes: data.length, sha256: hash(data) });
  }
  return { coverage: inventory.coverage, sourceInputs: inventory.sourceInputs, outputs };
}
if (import.meta.main) {
  if (Bun.argv.length !== 2) throw Error('Spectral notice generator takes no arguments');
  const result = await generateSpectralNotices();
  console.log('Spectral notices: ' + result.installedIdentities + '/' + result.lockIdentities + ' installed pinned identities; coverage incomplete');
}
