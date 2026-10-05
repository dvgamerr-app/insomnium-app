import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export function linuxOptions(args) {
  const bundleArgs = [];
  const configs = [];
  let bundles;
  let noBundle = false;
  const single = new Set(['--target', '-t', '--config', '-c', '--runner', '-r']);
  const multiple = new Set(['--bundles', '-b', '--features', '-f']);
  const flags = new Set(['--debug', '-d', '--verbose', '-v', '--ci', '--no-sign', '--skip-stapling', '--no-binary-patching']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') {
      if (args.slice(i + 1).some(value => !['--locked', '--offline', '--frozen'].includes(value))) {
        throw new Error('Linux packaging accepts Cargo --locked/--offline/--frozen only; use the documented manual build/bundle flow for custom Cargo profiles or output paths.');
      }
      break;
    }
    if (arg === '--no-bundle') { noBundle = true; continue; }
    const equal = arg.indexOf('=');
    const key = equal < 0 ? arg : arg.slice(0, equal);
    if (single.has(key)) {
      const value = equal < 0 ? args[++i] : arg.slice(equal + 1);
      if (!value || value.startsWith('-')) throw new Error('Missing value for ' + key);
      if (key === '--config' || key === '-c') configs.push(value);
      if (key !== '--runner' && key !== '-r') bundleArgs.push(key, value);
    } else if (multiple.has(key)) {
      const values = equal < 0 ? [] : [arg.slice(equal + 1)];
      if (equal < 0) while (i + 1 < args.length && !args[i + 1].startsWith('-')) values.push(args[++i]);
      if (!values.length || values.some(value => !value)) throw new Error('Missing value for ' + key);
      bundleArgs.push(key, ...values);
      if (key === '--bundles' || key === '-b') bundles = [...(bundles ?? []), ...values.flatMap(value => value.split(','))];
    } else if (flags.has(arg) || /^-v+$/.test(arg)) {
      bundleArgs.push(arg);
    } else {
      throw new Error('Unsupported Linux packaging option: ' + arg);
    }
  }
  return { bundleArgs, configs, bundles, noBundle };
}

export function mergeConfig(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const result = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid configuration key');
    if (value === null) delete result[key];
    else result[key] = mergeConfig(result[key], value);
  }
  return result;
}

async function readJsonConfig(value) {
  if (value.trim().startsWith('{')) return JSON.parse(value);
  if (!value.endsWith('.json')) throw new Error('The Linux packaging wrapper accepts JSON configuration files or inline JSON; use the manual flow for JSON5/TOML.');
  return Bun.file(resolve(value)).json();
}

async function run(args, captureBinary = false) {
  let binary;
  const child = Bun.spawn(args, { stdin: 'inherit', stdout: 'pipe', stderr: 'pipe' });
  async function forward(stream, destination) {
    const decoder = new TextDecoder();
    let pending = '';
    function inspect(line) {
      const plain = line.replace(/\x1b\[[0-9;]*m/g, '');
      const match = plain.match(/Built application at:\s*(.+)$/);
      if (match) binary = match[1].trim();
    }
    for await (const chunk of stream) {
      await Bun.write(destination, chunk);
      if (captureBinary) {
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? '';
        for (const line of lines) inspect(line);
        if (pending.length > 65536) pending = pending.slice(-65536);
      }
    }
    if (captureBinary) inspect(pending + decoder.decode());
  }
  const [, , exit] = await Promise.all([forward(child.stdout, Bun.stdout), forward(child.stderr, Bun.stderr), child.exited]);
  if (exit !== 0) throw new Error('Command failed with exit ' + exit + ': ' + args.slice(0, 5).join(' '));
  return binary;
}

export async function main(args = Bun.argv.slice(2)) {
  process.chdir(resolve(import.meta.dir, '..'));
  const cli = [process.execPath, 'x', '--bun', 'tauri'];
  if (process.platform !== 'linux' || args.includes('--help') || args.includes('-h') || args.includes('--no-bundle')) {
    await run([...cli, 'build', ...args]);
    return;
  }
  const options = linuxOptions(args);
  if (options.noBundle) { await run([...cli, 'build', ...args]); return; }
  let config = await Bun.file('src-tauri/tauri.conf.json').json();
  if (await Bun.file('src-tauri/tauri.linux.conf.json').exists()) {
    config = mergeConfig(config, await Bun.file('src-tauri/tauri.linux.conf.json').json());
  }
  for (const value of options.configs) config = mergeConfig(config, await readJsonConfig(value));
  const selected = options.bundles ?? config.bundle?.targets ?? 'all';
  const hasRpm = selected === 'all' || (Array.isArray(selected) ? selected.includes('rpm') || selected.includes('all') : selected === 'rpm');
  const hasAppImage = selected === 'all' || (Array.isArray(selected) ? selected.includes('appimage') || selected.includes('all') : selected === 'appimage');
  const hasDeb = selected === 'all' || (Array.isArray(selected) ? selected.includes('deb') || selected.includes('all') : selected === 'deb');
  if (config.bundle?.active === false || (!hasRpm && !hasAppImage && !hasDeb)) {
    await run([...cli, 'build', ...args]);
    return;
  }
  const separator = args.indexOf('--');
  const buildArgs = separator < 0 ? [...args, '--no-bundle'] : [...args.slice(0, separator), '--no-bundle', ...args.slice(separator)];
  const binary = await run([...cli, 'build', ...buildArgs], true);
  if (!binary) throw new Error('Tauri did not report the built executable path; refusing stale packaging metadata');
  const directory = await mkdtemp(join(tmpdir(), 'insomnium-packaging-'));
  try {
    const overlay = join(directory, 'dependencies.json');
    let generated = { bundle: { linux: {} } };
    if (hasDeb) {
      await run([process.execPath, 'scripts/generate-deb-config.mjs', binary, overlay]);
      generated = await Bun.file(overlay).json();
      const additional = config.bundle?.linux?.deb?.depends ?? [];
      generated.bundle.linux.deb.depends = [...new Set([...additional, ...generated.bundle.linux.deb.depends])].sort();
    }
    if (hasRpm) {
      await run([process.execPath, 'scripts/generate-rpm-config.mjs', binary, overlay]);
      generated = mergeConfig(generated, await Bun.file(overlay).json());
      const additional = config.bundle?.linux?.rpm?.depends ?? [];
      generated.bundle.linux.rpm.depends = [...new Set([...additional, ...generated.bundle.linux.rpm.depends])].sort();
    }
    if (hasAppImage) {
      const appimageOverlay = join(directory, 'appimage.json');
      await run([process.execPath, 'scripts/generate-appimage-config.mjs', binary, appimageOverlay]);
      const appimage = await Bun.file(appimageOverlay).json();
      const customFiles = config.bundle?.linux?.appimage?.files ?? {};
      for (const destination of Object.keys(appimage.bundle.linux.appimage.files)) {
        const relative = destination.replace(/^\//, '');
        if (destination in customFiles || relative in customFiles) {
          throw new Error('Reserved AppImage dependency destination: ' + destination);
        }
      }
      generated = mergeConfig(generated, appimage);
    }
    await Bun.write(overlay, JSON.stringify(generated, null, 2) + '\n');
    await run([...cli, 'bundle', ...options.bundleArgs, '--config', overlay]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();
