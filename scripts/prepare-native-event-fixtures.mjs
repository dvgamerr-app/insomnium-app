import assert from 'node:assert/strict';
import {resolve, relative, sep} from 'node:path';
import {createSvelteUiFixturePlugin} from '../tests/ui/helpers/component-fixture.js';

/** Build the same saved fixtures used by browser scenarios, without launching an app.
 * Production plugin/template workers remain the unmodified Vite build outputs.
 * @returns {Promise<Map<string,Uint8Array>>} */
export async function nativeEventFixtureAssets() {
  const entries = [
    ['event-fixture.js', 'tests/ui/fixtures/plugin-dom-event-channel.js', 'iife'],
    ['event-probe-worker.js', 'tests/ui/fixtures/plugin-dom-event-channel.worker.js', 'esm'],
    ['event-owner-fixture.js', 'tests/ui/fixtures/plugin-dom-render-owner.js', 'iife'],
  ];
  const assets = new Map();
  for (const [name, entry, format] of entries) {
    const bundle = await Bun.build({
      entrypoints: [entry], target: 'browser', format: /** @type {'iife'|'esm'} */ (format),
      conditions: ['browser', 'svelte'], plugins: [createSvelteUiFixturePlugin()],
      // page.evaluate executes IIFEs as classic scripts. The owner fixture
      // injects actual Vite worker URLs; its unused default worker constructor
      // still needs a valid URL base rather than module-only import.meta.
      ...(format === 'iife' ? {define: {'import.meta.url': JSON.stringify('http://tauri.localhost/event-probe/' + name)}} : {}),
    });
    assert.equal(bundle.success, true, bundle.logs.map(String).join('\n'));
    assert.equal(bundle.outputs.length, 1, 'Native event fixture must remain one self-contained bundle');
    const bytes = new Uint8Array(await bundle.outputs[0].arrayBuffer());
    if (format === 'iife') {
      const source = new TextDecoder().decode(bytes);
      assert.doesNotMatch(source, /\bimport\s*\.\s*meta\b/, 'Native classic fixture cannot retain import.meta');
      // Parse without executing browser code before embedding a native build.
      new Function(source);
    }
    assets.set(name, bytes);
  }
  assets.set('event-engine.wasm', await Bun.file('node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm').bytes());
  return assets;
}

// bun scripts/prepare-native-event-fixtures.mjs
// bun run desktop:build --no-bundle
// Opt-in preparation only: run before the frontend build, then build the native
// candidate. SvelteKit copies static/event-probe into the candidate's frontend.
if (import.meta.main) {
  const outdir = resolve(process.argv[2] ?? 'static/event-probe');
  assert.ok(outdir === resolve('static/event-probe') || outdir.startsWith(resolve('artifacts') + sep), 'Fixture output must stay in its static directory or local artifacts');
  assert.ok(!relative(resolve('.'), outdir).split(sep).includes('.git'), 'Never write fixture files in Git internals');
  const assets = await nativeEventFixtureAssets();
  await Bun.write(resolve(outdir, '.gitignore'), '*\n!.gitignore\n');
  for (const [name, bytes] of assets) await Bun.write(resolve(outdir, name), bytes);
  console.log(`Prepared ${assets.size} native event fixture assets in ${outdir}`);
}
