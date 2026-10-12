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
  { component: 'libuv', sourcePin: '8023581113b276e7c1aee3f82da57ca0893faab1', declaredBuildCondition: 'Bun dependency enabled when cfg.windows; header version 1.51.1', origins: ['https://raw.githubusercontent.com/oven-sh/libuv/8023581113b276e7c1aee3f82da57ca0893faab1/LICENSE'], path: 'tools/spectral-linter/notice-sources/libuv-802358-LICENSE', bytes: 1079, sha256: '16de0c32b265cb7d46a6d3bd614f259dd4d693a5e26b3407b04aae8d73041f0c' },
  { component: 'Bun-vendored uSockets and uWS', sourcePin: runtimeSourceIdentity.revision, declaredBuildCondition: 'Bun source glob includes vendored uSockets; uWS inventory source text at the same Bun revision', origins: ['https://raw.githubusercontent.com/oven-sh/bun/744846f844374847c902b5e7fd59b4342a51ef99/packages/bun-usockets/LICENSE', 'https://raw.githubusercontent.com/oven-sh/bun/744846f844374847c902b5e7fd59b4342a51ef99/packages/bun-uws/LICENSE'], path: 'tools/spectral-linter/notice-sources/bun-744846-uSockets-uWS-LICENSE', bytes: 11357, sha256: 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4' },
  { component: 'JavaScriptCore COPYING.LIB', sourcePin: '2e2aa2290fac856d6f451ceacb58f7f5b44dd057', declaredBuildCondition: 'Bun default WebKit source pin; prebuilt variant and linked objects unproven', origins: ['https://raw.githubusercontent.com/oven-sh/WebKit/2e2aa2290fac856d6f451ceacb58f7f5b44dd057/Source/JavaScriptCore/COPYING.LIB'], path: 'tools/spectral-linter/notice-sources/jsc-2e2aa-COPYING.LIB', bytes: 25584, sha256: '5094ecb9c9dcd0eadc34f3c11511d9b5535063032bc150164ecd1a5d5a445547' },
  { component: 'ICU root LICENSE', sourcePin: '21d1eb0f306e1141c10931e914dfc038c06121da', declaredBuildCondition: 'Pinned WebKit Windows build script references ICU 78.3; release-78.3 resolves this revision; icu4c/LICENSE resolves ../LICENSE', origins: ['https://raw.githubusercontent.com/unicode-org/icu/21d1eb0f306e1141c10931e914dfc038c06121da/LICENSE'], path: 'tools/spectral-linter/notice-sources/icu-21d1eb-LICENSE', bytes: 27718, sha256: 'e55522d81edc687a341a4411e0776e54ca654e90147f354a90458aaced4116af' },
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
  const inventory = { schemaVersion: 1, coverage: 'incomplete', completenessBlocksBuild: false, lockIdentities: locked.length, installedIdentities: packages.filter(x => x.state === 'installed').length, packages, runtime: { ...sources.bun, coverage: 'incomplete', reason: 'Pinned upstream LICENSE.md inventories linked libraries/polyfills; their full texts and redistribution acceptance remain unverified.' }, runtimeSourceTexts: sourceTexts, sourceInputs: [...inputs.values()].sort((a, b) => order(a.path, b.path)) };
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
