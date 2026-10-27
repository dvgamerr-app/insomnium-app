const fs = require('node:fs');
const path = require('node:path');
const { dlopen, ptr } = require('bun:ffi');

function checkReadOnly() {
  if (process.env.UV_THREADPOOL_SIZE !== '2') throw Error('Unexpected sandbox I/O pool size');
  const kernel = dlopen('kernel32.dll', {
    GetLastError: { args: [], returns: 'u32' },
    CloseHandle: { args: ['u64'], returns: 'i32' },
    CreateFileW: { args: ['ptr', 'u32', 'u32', 'ptr', 'u32', 'u32', 'u64'], returns: 'i64' },
    WriteFile: { args: ['u64', 'ptr', 'u32', 'ptr', 'ptr'], returns: 'i32' },
  });
  const security = dlopen('advapi32.dll', {
    OpenProcessToken: { args: ['i64', 'u32', 'ptr'], returns: 'i32' },
    OpenThreadToken: { args: ['i64', 'u32', 'i32', 'ptr'], returns: 'i32' },
    GetTokenInformation: { args: ['u64', 'u32', 'ptr', 'u32', 'ptr'], returns: 'i32' },
    SetTokenInformation: { args: ['u64', 'u32', 'ptr', 'u32'], returns: 'i32' },
    SetNamedSecurityInfoW: { args: ['ptr', 'u32', 'u32', 'ptr', 'ptr', 'ptr', 'ptr'], returns: 'u32' },
    RegSetValueExW: { args: ['u64', 'ptr', 'u32', 'u32', 'ptr', 'u32'], returns: 'i32' },
    RegCloseKey: { args: ['u64'], returns: 'i32' },
  });
  const profile = dlopen('userenv.dll', {
    GetAppContainerRegistryLocation: { args: ['u32', 'ptr'], returns: 'i32' },
  });
  try {
    const k = kernel.symbols, a = security.symbols;
    const token = new BigUint64Array(new ArrayBuffer(8));
    if (!a.OpenProcessToken(-1n, 8, ptr(token))) throw Error('Token query control failed');
    const bytes = new Uint8Array(new ArrayBuffer(128)), size = new Uint32Array(1), view = new DataView(bytes.buffer);
    let integrity, policy, app;
    try {
      if (!a.GetTokenInformation(token[0], 25, ptr(bytes), bytes.length, ptr(size))) throw Error('Integrity query failed');
      const offset = Number(view.getBigUint64(0, true)) - ptr(bytes);
      if (offset < 0 || offset + 12 > bytes.length || bytes[offset] !== 1 || bytes[offset + 1] !== 1 || bytes[offset + 7] !== 16) throw Error('Unexpected integrity SID');
      integrity = view.getUint32(offset + 8, true);
      if (!a.GetTokenInformation(token[0], 27, ptr(bytes), bytes.length, ptr(size))) throw Error('Policy query failed');
      policy = view.getUint32(0, true);
      if (!a.GetTokenInformation(token[0], 29, ptr(bytes), bytes.length, ptr(size))) throw Error('AppContainer query failed');
      app = view.getUint32(0, true);
    } finally { k.CloseHandle(token[0]); }
    if (integrity !== 0 || !(policy & 1) || app !== 1) throw Error('Unexpected sandbox identity');
    if (a.OpenThreadToken(-2n, 8, 1, ptr(token))) { k.CloseHandle(token[0]); throw Error('Unexpected impersonation token'); }
    if (k.GetLastError() !== 1008) throw Error('Unexpected thread token error');

    const filename = Buffer.from(path.resolve('package/main.cjs') + '\0', 'utf16le');
    const invalid = handle => BigInt.asUintN(64, BigInt(handle)) === 18446744073709551615n;
    const read = k.CreateFileW(ptr(filename), 0x80000000, 7, null, 3, 128, 0n);
    if (invalid(read)) throw Error('Native read control failed');
    k.CloseHandle(read);
    const append = k.CreateFileW(ptr(filename), 4, 7, null, 3, 128, 0n), appendError = k.GetLastError();
    if (!invalid(append)) {
      try {
        const payload = Buffer.from('bad'), written = new Uint32Array(1);
        const success = k.WriteFile(append, ptr(payload), payload.length, ptr(written), null), error = k.GetLastError();
        if (success || error !== 5) throw Error('Native append was not denied');
      } finally { k.CloseHandle(append); }
    } else if (appendError !== 5) throw Error('Unexpected native append refusal');
    if (a.SetNamedSecurityInfoW(ptr(filename), 1, 4, null, null, null, null) !== 5) throw Error('DACL rewrite was not denied');

    let tokenProtection = 'open-denied';
    const adjusted = a.OpenProcessToken(-1n, 0x88, ptr(token)), adjustError = k.GetLastError();
    if (adjusted) {
      try {
        const off = new Uint32Array(new ArrayBuffer(4));
        if (a.SetTokenInformation(token[0], 27, ptr(off), 4) || ![5, 1314].includes(k.GetLastError())) throw Error('Policy relaxation was not denied');
        const label = new Uint8Array(new ArrayBuffer(32)), data = new DataView(label.buffer);
        label.set([1, 1, 0, 0, 0, 0, 0, 16], 16);
        data.setUint32(24, 4096, true); data.setBigUint64(0, BigInt(ptr(label) + 16), true); data.setUint32(8, 32, true);
        if (a.SetTokenInformation(token[0], 25, ptr(label), 28) || ![5, 1314].includes(k.GetLastError())) throw Error('Integrity raise was not denied');
        tokenProtection = 'set-denied';
      } finally { k.CloseHandle(token[0]); }
    } else if (adjustError !== 5) throw Error('Unexpected token refusal');
    const key = new BigUint64Array(new ArrayBuffer(8)), opened = profile.symbols.GetAppContainerRegistryLocation(0x20006, ptr(key));
    if (opened === 0) {
      try {
        const name = Buffer.from('insomnium-write-probe\0', 'utf16le'), value = Buffer.from('bad\0', 'utf16le');
        if (a.RegSetValueExW(key[0], ptr(name), 0, 1, ptr(value), value.length) !== 5) throw Error('Registry write was not denied');
      } finally { a.RegCloseKey(key[0]); }
    } else if ((opened >>> 0) !== 0x80070005) throw Error('Unexpected registry refusal');

    let fileOperations = 0;
    const denied = (name, run) => {
      try { run(); } catch (error) {
        if (['EACCES', 'EPERM'].includes(error.code)) { fileOperations++; return; }
        throw error;
      }
      throw Error('Unrestricted file operation: ' + name);
    };
    denied('profile-create', () => fs.writeFileSync('must-not-exist', 'bad', { flag: 'wx' }));
    denied('profile-mkdir', () => fs.mkdirSync('must-not-create'));
    denied('base-create', () => fs.writeFileSync('../must-not-exist', 'bad', { flag: 'wx' }));
    denied('base-mkdir', () => fs.mkdirSync('../must-not-create'));
    denied('package-overwrite', () => fs.writeFileSync('package/canary.json', 'bad'));
    denied('package-append', () => fs.appendFileSync('package/main.cjs', 'bad'));
    denied('package-delete', () => fs.unlinkSync('package/canary.json'));
    denied('package-rename', () => fs.renameSync('package/canary.json', 'package/moved.json'));
    denied('package-attributes', () => fs.chmodSync('package/canary.json', 0o444));
    denied('alternate-stream', () => fs.writeFileSync('package/canary.json:hidden', 'bad'));
    denied('hardlink', () => fs.linkSync('package/canary.json', 'package/linked.json'));
    if (fs.readFileSync('package/canary.json', 'utf8') !== 'must-survive') throw Error('Damaged source canary');
    return { fileOperations, nativeAppendDenied: true, daclRewriteDenied: true, registryWriteDenied: true, tokenProtection, appContainer: true, integrity, policy };
  } finally { profile.close(); security.close(); kernel.close(); }
}

checkReadOnly();
exports.themes = [{ name: 'literal', theme: { background: { default: '#111' } } }];
exports.requestHooks = [async () => {
  const proof = checkReadOnly();
  const denied = async run => {
    try { await run(); } catch (error) { if (['EACCES', 'EPERM'].includes(error.code)) return; throw error; }
    throw Error('Unrestricted asynchronous write');
  };
  await denied(() => Bun.write('package/canary.json', 'bad'));
  await denied(() => fs.promises.writeFile('package/canary.json', 'bad'));
  if (fs.readFileSync('package/canary.json', 'utf8') !== 'must-survive') throw Error('Damaged async source canary');
  const reads = await Promise.all([Bun.file('package/canary.json').text(), fs.promises.readFile('package/canary.json', 'utf8')]);
  if (reads.some(value => value !== 'must-survive')) throw Error('Allowed async reads changed source bytes');
  return { ...proof, asyncWrites: 2, asyncReads: 2 };
}];
