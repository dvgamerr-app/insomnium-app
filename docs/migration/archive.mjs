// One-time archive inventory; run with Bun. No runtime from the legacy app is loaded.
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
const root = 'E:/insomnium';
const manifestPath = join(root, 'docs/migration/archive-manifest.json');
const mode = Bun.argv[2];
const excluded = new Set(['.git', 'AGENTS.md', 'docs', '_backup']);
async function walk(directory) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlink: ${path}`);
    if (entry.isDirectory()) results.push(...await walk(path));
    else results.push(path);
  }
  return results;
}
async function hash(path) {
  return new Bun.CryptoHasher('sha256').update(await Bun.file(path).arrayBuffer()).digest('hex');
}
if (mode === 'capture') {
  if (await Bun.file(manifestPath).exists()) throw new Error('Manifest already exists; do not overwrite original evidence');
  const entries = (await readdir(root)).filter(name => !excluded.has(name));
  const files = [];
  for (const name of entries) {
    const path = join(root, name);
    const paths = (await Bun.file(path).stat()).isDirectory() ? await walk(path) : [path];
    for (const file of paths) files.push({ path: relative(root, file).replaceAll('\\', '/'), size: (await Bun.file(file).stat()).size, sha256: await hash(file) });
  }
  await Bun.write(manifestPath, JSON.stringify({ capturedAt: new Date().toISOString(), gitHead: 'b49e4db', entries, files }, null, 2) + '\n');
  console.log(`Captured ${files.length} files in ${entries.length} root entries`);
} else if (mode === 'verify') {
  const manifest = await Bun.file(manifestPath).json();
  for (const file of manifest.files) {
    const path = join(root, '_backup/legacy-electron', file.path);
    if (!(await Bun.file(path).exists()) || await hash(path) !== file.sha256) throw new Error(`Archive mismatch: ${file.path}`);
  }
  console.log(`Verified all ${manifest.files.length} archived files (SHA-256)`);
} else throw new Error('Usage: bun docs/migration/archive.mjs capture|verify');
