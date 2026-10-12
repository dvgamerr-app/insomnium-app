import assert from "node:assert/strict";
import {
  mkdir,
  readFile,
  writeFile,
  lstat,
  realpath,
  readdir,
  unlink,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { probeIdentifier, poll } from "./native-app.js";
import {
  knownWindowsApplicationData,
  resourceCrudProbeIdentifier,
} from "./native-profile-ownership.js";

/** @type {{register:(id:string,name:string)=>void}|null} */
let activePreservation = null;
/** Register only an actual newly inserted fixture collection, before buffers restore.
 * @param {string} id @param {string} name */
export function registerResourceProbeCollection(id, name) {
  assert.ok(
    activePreservation,
    "Fixture registration requires an active preservation wrapper",
  );
  activePreservation.register(id, name);
}

/** Existing native exact-byte restoration, with explicit cold owned-profile support.
 * @param {(capture:()=>Promise<void>)=>Promise<void>} run
 * @param {{expectedIdentifier?:string,profileOwnershipPath?:string,lazyCapture?:boolean}} [options] */
export async function withResourceProbePreserved(run, options = {}) {
  assert.equal(activePreservation, null, "No nested profile preservation");
  const identifier = options.expectedIdentifier ?? probeIdentifier;
  assert.ok(
    [probeIdentifier, resourceCrudProbeIdentifier].includes(identifier),
  );
  const isolated = identifier === resourceCrudProbeIdentifier;
  assert.equal(
    !!options.lazyCapture,
    isolated,
    "Lazy capture is only allowed for fixed isolated CRUD profile",
  );
  const root = resolve(knownWindowsApplicationData(), identifier);
  const canonical = (/** @type {string} */ path) => resolve(path).toLowerCase();
  if (isolated) {
    assert.ok(options.profileOwnershipPath);
    const marker = await Bun.file(options.profileOwnershipPath).json();
    assert.equal(marker.identifier, identifier);
    assert.equal(marker.initiallyAbsent, true);
    assert.equal(canonical(marker.profile), canonical(root));
  }
  const output = resolve(
    "artifacts/playwright/resource-manager-restoration-" + Date.now(),
  );
  await mkdir(output, { recursive: true });
  const exists = async (/** @type {string} */ path) =>
    lstat(path).then(
      () => true,
      (error) => {
        if (error.code === "ENOENT") return false;
        throw error;
      },
    );
  const regular = async (/** @type {string} */ path) => {
    const info = await lstat(path);
    assert.ok(info.isFile() && !info.isSymbolicLink());
    assert.equal(canonical(await realpath(path)), canonical(path));
  };
  const hash = (/** @type {Uint8Array} */ bytes) =>
    createHash("sha256").update(bytes).digest("hex");
  const immutable = async () => {
    const result = /** @type {Record<string,string>} */ ({});
    for (const name of [
      "plugin-data-v1.json",
      "plugin-data-v1.previous.json",
    ]) {
      const path = join(root, name);
      if (await exists(path)) {
        await regular(path);
        result[name] = hash(await readFile(path));
      }
    }
    const cookies = join(root, "cookies");
    if (await exists(cookies)) {
      const info = await lstat(cookies);
      assert.ok(info.isDirectory() && !info.isSymbolicLink());
      assert.equal(canonical(await realpath(cookies)), canonical(cookies));
      for (const name of await readdir(cookies)) {
        const path = join(cookies, name);
        await regular(path);
        result["cookies/" + name] = hash(await readFile(path));
      }
    } else
      assert.ok(isolated, "Default profile must already have cookie directory");
    return result;
  };
  const originals =
    /** @type {{name:string,path:string,bytes:Buffer|null}[]} */ ([]);
  let before = /** @type {Record<string,string>|null} */ (null);
  let oldIds = new Set();
  const owned = /** @type {Map<string,string>} */ (new Map());
  const capture = async () => {
    assert.equal(
      before,
      null,
      "Capture baseline only once before fixture writes",
    );
    const info = await lstat(root);
    assert.ok(info.isDirectory() && !info.isSymbolicLink());
    assert.equal(canonical(await realpath(root)), canonical(root));
    if (isolated) {
      const marker = await Bun.file(
        /** @type {string} */ (options.profileOwnershipPath),
      ).json();
      assert.equal(marker.state, "owned");
      assert.equal(
        canonical(marker.launches.at(-1).nativePath),
        canonical(root),
      );
    }
    for (const name of ["workspace-v1.json", "workspace-v1.previous.json"]) {
      const path = join(root, name);
      const present = await exists(path);
      assert.ok(
        present || isolated,
        "Default profile requires both original buffers",
      );
      if (present) await regular(path);
      const bytes = present ? await readFile(path) : null;
      originals.push({ name, path, bytes });
      if (bytes) await writeFile(join(output, "original-" + name), bytes);
    }
    const current = originals[0].bytes;
    if (current)
      oldIds = new Set(
        JSON.parse(current.toString()).resources.map(
          (/** @type {Record<string,any>} */ item) => item._id,
        ),
      );
    before = await immutable();
    await Bun.write(
      join(output, "before.json"),
      JSON.stringify(
        {
          identifier,
          root,
          buffers: originals.map(({ name, bytes }) => ({
            name,
            present: bytes !== null,
            sha256: bytes ? hash(bytes) : null,
          })),
          immutable: before,
        },
        null,
        2,
      ),
    );
  };
  if (!isolated) await capture();
  activePreservation = {
    register(id, name) {
      assert.ok(before, "Baseline capture precedes fixture registration");
      assert.match(id, /^wrk_[a-zA-Z0-9_-]+$/);
      assert.ok(
        name && !oldIds.has(id),
        "Only a newly added owned fixture collection can register",
      );
      owned.set(id, name);
    },
  };
  try {
    await run(capture);
  } finally {
    activePreservation = null;
    const errors = /** @type {unknown[]} */ ([]);
    const cleanup = /** @type {Record<string,any>[]} */ ([]);
    if (before) {
      // Freeze changed native data and bind actual fixture IDs BEFORE restoring either buffer.
      for (const original of originals) {
        try {
          if (await exists(original.path)) {
            await regular(original.path);
            await writeFile(
              join(output, "changed-" + original.name),
              await readFile(original.path),
            );
          }
        } catch (error) {
          errors.push(error);
        }
      }
      let changedData = /** @type {Record<string,any>|null} */ (null);
      try {
        if (await exists(originals[0].path))
          changedData = JSON.parse(
            (await readFile(originals[0].path)).toString(),
          );
      } catch (error) {
        errors.push(error);
      }
      for (const original of originals) {
        try {
          if (original.bytes) {
            if (await exists(original.path)) await regular(original.path);
            await writeFile(original.path, original.bytes);
            assert.ok((await readFile(original.path)).equals(original.bytes));
          } else if (await exists(original.path)) {
            assert.ok(isolated);
            await regular(original.path);
            await unlink(original.path);
          }
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        const after = await immutable();
        for (const [name, sha] of Object.entries(after)) {
          if (name in before) {
            assert.equal(
              sha,
              before[name],
              "Original immutable bytes changed: " + name,
            );
            continue;
          }
          const match =
            /^cookies\/(wrk_[a-zA-Z0-9_-]+)(?:\.previous)?\.json$/.exec(name);
          const id = match?.[1];
          const collection = changedData?.resources?.find(
            (/** @type {Record<string,any>} */ item) =>
              item._id === id && item._type === "workspace",
          );
          assert.ok(
            id && owned.has(id) && collection?.name === owned.get(id),
            "Unknown new file retained; no fixture ID proof: " + name,
          );
          const path = resolve(root, name);
          assert.equal(
            canonical(path),
            canonical(join(root, "cookies", name.slice(8))),
          );
          await regular(path);
          const bytes = await readFile(path);
          assert.equal(hash(bytes), sha);
          await writeFile(join(output, "owned-" + name.slice(8)), bytes);
          await unlink(path);
          cleanup.push({
            name,
            collectionId: id,
            collectionName: owned.get(id),
            sha256: sha,
          });
        }
        const final = await immutable();
        assert.equal(
          Object.keys(final).length,
          Object.keys(before).length,
          "Exact immutable file set restored",
        );
        for (const [name, sha] of Object.entries(before))
          assert.equal(
            final[name],
            sha,
            "Exact immutable bytes restored: " + name,
          );
      } catch (error) {
        errors.push(error);
      }
    } else if (isolated)
      errors.push(
        Error(
          "Owned cold profile baseline was not captured; no fixture mutation allowed",
        ),
      );
    await Bun.write(
      join(output, "result.json"),
      JSON.stringify(
        {
          passed: errors.length === 0,
          identifier,
          root,
          buffers: originals.map(({ name, bytes }) => ({
            name,
            present: bytes !== null,
            sha256: bytes ? hash(bytes) : null,
          })),
          immutable: before,
          registered: [...owned],
          cleanup,
          errors: errors.map(String),
        },
        null,
        2,
      ),
    );
    if (errors.length)
      throw new AggregateError(
        errors,
        "Probe preservation failed; unknown files retained",
      );
  }
}

/** @param {import('playwright-core').Page} page */
export async function resourceSaved(page) {
  await poll(
    async () =>
      (await page.locator(".status-save").innerText()).includes(
        "Local workspace",
      ),
    "Resource save settled",
  );
}

/** @param {import('playwright-core').Page} page @param {string} name */
export async function manageResource(page, name) {
  await page
    .getByRole("button", { name: "Manage " + name, exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).waitFor();
  return dialog;
}

/** Assert exact copied payload and known references without duplicating model code.
 * @param {Record<string,any>[]} source @param {Record<string,any>[]} copies
 * @param {string} originalRoot @param {string} copiedRoot */
export function assertResourceCopy(source, copies, originalRoot, copiedRoot) {
  assert.equal(copies.length, source.length);
  const mapping = new Map();
  for (const original of source) {
    const copy = copies.find((item) => item.crudMarker === original.crudMarker);
    assert.ok(copy, "Every owned marker copied exactly once");
    assert.equal(
      copies.filter((item) => item.crudMarker === original.crudMarker).length,
      1,
    );
    assert.notEqual(copy._id, original._id);
    mapping.set(original._id, copy._id);
  }
  assert.equal(mapping.get(originalRoot), copiedRoot);
  for (const original of source) {
    const copy = copies.find((item) => item._id === mapping.get(original._id));
    assert.ok(copy);
    const expected = structuredClone(original);
    expected._id = copy._id;
    expected.parentId = mapping.get(original.parentId) ?? original.parentId;
    for (const field of [
      "requestId",
      "activePayloadId",
      "protoFileId",
      "sourceSpecId",
    ]) {
      if (mapping.has(original[field]))
        expected[field] = mapping.get(original[field]);
    }
    expected.created = copy.created;
    expected.modified = copy.modified;
    assert.ok(copy.created > 1 && copy.modified >= copy.created);
    if (original._id === originalRoot) {
      expected.name = original.name + " (copy)";
      expected.metaSortKey = copy.metaSortKey;
    }
    assert.deepEqual(
      copy,
      expected,
      "Exact payload preserved; only owned IDs/time/root name/order change",
    );
  }
}
