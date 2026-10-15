import assert from "node:assert/strict";
import { parseLegacyFiles } from "../../../src/lib/legacy-import.js";
import { parseImport } from "../../../src/lib/import-export.js";

/** Real NeDB decoding and additive import, without browser/native/network I/O.
 * Pass a frozen grpc-model module to reproduce the prior implementation's failures.
 * @param {{protoInput: Function, protoFiles: Function}} [implementation] */
export async function assertProtoRootModel(implementation) {
  const model = implementation ?? await import("../../../src/lib/grpc-model.js");
  /** @type {Record<string, any>[]} */
  const records = [
    { _id: "wrk_owned", type: "Workspace", parentId: null, name: "Proto roots", scope: "collection" },
    { _id: "dir_a", type: "ProtoDirectory", parentId: "wrk_owned", name: "shared" },
    { _id: "dir_b", type: "ProtoDirectory", parentId: "wrk_owned", name: "shared" },
    { _id: "dir_first", type: "ProtoDirectory", parentId: "dir_a", name: "first" },
    { _id: "dir_second", type: "ProtoDirectory", parentId: "dir_a", name: "second" },
    { _id: "dir_deep", type: "ProtoDirectory", parentId: "dir_first", name: "deep" },
    { _id: "dir_empty", type: "ProtoDirectory", parentId: "dir_first", name: "empty" },
    { _id: "dir_last", type: "ProtoDirectory", parentId: "dir_second", name: "last" },
    { _id: "pf_a", type: "ProtoFile", parentId: "dir_a", name: "entry.proto", protoText: 'syntax = "proto3"; package selected; message A {}' },
    { _id: "pf_deep", type: "ProtoFile", parentId: "dir_deep", name: "dep.proto", protoText: 'syntax = "proto3"; package selected; message Dependency {}' },
    { _id: "pf_b", type: "ProtoFile", parentId: "dir_b", name: "entry.proto", protoText: 'syntax = "proto3"; package unrelated; message B {}' },
    { _id: "req_owned", type: "GrpcRequest", parentId: "wrk_owned", name: "Selected proto", protoFileId: "pf_a", url: "grpc://127.0.0.1:1", literal: { protoFileId: "pf_a" } },
  ];
  const uniqueRecords = records.map(row => row._id === "dir_b" ? { ...row, name: "unrelated" } : row);
  const unsafeRecords = [
    ...uniqueRecords,
    { _id: "dir_unsafe", type: "ProtoDirectory", parentId: "wrk_owned", name: "unsafe" },
    { _id: "dir_escape", type: "ProtoDirectory", parentId: "dir_unsafe", name: ".." },
    { _id: "pf_unsafe", type: "ProtoFile", parentId: "dir_escape", name: "bad.proto", protoText: 'syntax = "proto3";' },
  ];
  /** @param {Record<string, any>[]} source */
  function imported(source) {
    const decoded = parseLegacyFiles([{ name: "insomnia.proto-regression.db", text: source.map(row => JSON.stringify(row)).join("\r\n") }]);
    const review = parseImport(JSON.stringify(decoded));
    assert.equal(review.requests, source.filter(row => row.type === "GrpcRequest").length,
      "Import review counts executable gRPC requests");
    assert.equal(review.preserved, 0, "Proto and gRPC models are recognized by import review");
    const byOld = new Map(review.resources.map(row => [row._legacySource.record._id, row]));
    /** @param {string} oldId */
    function get(oldId) {
      const row = byOld.get(oldId);
      assert.ok(row, "Missing imported source identity: " + oldId);
      return row;
    }
    for (const original of source) {
      const row = get(original._id);
      assert.ok(row);
      assert.notEqual(row._id, original._id, "Every imported resource ID is remapped");
      assert.deepEqual(row._legacySource.record, original, "NeDB provenance remains exact");
      if (original.parentId) assert.equal(row.parentId, get(original.parentId)._id);
    }
    assert.equal(get("req_owned").protoFileId, get("pf_a")._id);
    assert.deepEqual(get("req_owned").literal, { protoFileId: "pf_a" });
    return { resources: review.resources, get };
  }
  const clean = imported(records), unique = imported(uniqueRecords), unsafe = imported(unsafeRecords);
  const cleanBefore = structuredClone(clean.resources), uniqueBefore = structuredClone(unique.resources), unsafeBefore = structuredClone(unsafe.resources);
  /** @param {ReturnType<typeof imported>} fixture @param {string} [oldId] */
  const select = (fixture, oldId = "pf_a") => model.protoInput(fixture.resources, fixture.get("wrk_owned")._id, fixture.get(oldId)._id);
  /** @type {{name:string,run:()=>void}[]} */
  const checks = [
    { name: "duplicate display roots isolate by imported identity", run() {
      assert.deepEqual(select(clean).files, [
        { name: "entry.proto", text: records.find(row => row._id === "pf_a")?.protoText },
        { name: "first/deep/dep.proto", text: records.find(row => row._id === "pf_deep")?.protoText },
      ]);
      assert.equal(select(clean).entry, "entry.proto");
      assert.deepEqual(select(clean, "pf_b").files, [{ name: "entry.proto", text: records.find(row => row._id === "pf_b")?.protoText }]);
    } },
    { name: "include paths use parent-before-child DFS including empty directories", run() {
      assert.deepEqual(select(unique).includePaths, ["first", "first/deep", "first/empty", "second", "second/last"]);
    } },
    { name: "unrelated unsafe root cannot block selected valid root", run() {
      assert.deepEqual(select(unsafe), select(unique));
    } },
    { name: "tolerant picker retains usable imported IDs", run() {
      const choices = model.protoFiles(unsafe.resources, unsafe.get("wrk_owned")._id, { skipInvalid: true });
      assert.deepEqual(choices.map(/** @param {any} row */ row => row.id), ["pf_a", "pf_deep", "pf_b"].map(old => unsafe.get(old)._id));
      assert.throws(() => model.protoFiles(unsafe.resources, unsafe.get("wrk_owned")._id), /Invalid proto name/);
    } },
    { name: "selected unsafe subtree is refused", run() {
      assert.throws(() => select(unsafe, "pf_unsafe"), /Invalid proto name/);
      const selectedBad = structuredClone(unique.resources);
      selectedBad.push({ _id: "owned_bad_empty", _type: "proto_directory", parentId: unique.get("dir_a")._id, name: ".." });
      assert.throws(() => model.protoInput(selectedBad, unique.get("wrk_owned")._id, unique.get("pf_a")._id), /Invalid proto name/);
    } },
    { name: "256 empty include directories accepted and 257 refused", run() {
      const base = uniqueRecords.filter(row => ["wrk_owned", "dir_a", "pf_a", "req_owned"].includes(row._id));
      const directories = Array.from({ length: 256 }, (_, index) => ({ _id: "dir_bound_" + index, type: "ProtoDirectory", parentId: "dir_a", name: "include" + index }));
      const accepted = imported([...base, ...directories]);
      assert.deepEqual(select(accepted).includePaths, directories.map(row => row.name));
      const refused = imported([...base, ...directories, { _id: "dir_bound_extra", type: "ProtoDirectory", parentId: "dir_a", name: "extra" }]);
      assert.throws(() => select(refused), /at most 256 include directories/);
    } },
    { name: "2 MiB file accepted and one additional byte refused", run() {
      const base = uniqueRecords.filter(row => ["wrk_owned", "dir_a", "pf_a", "req_owned"].includes(row._id));
      const text = "/".repeat(2 * 1024 * 1024);
      const accepted = imported(base.map(row => row._id === "pf_a" ? { ...row, protoText: text } : row));
      assert.equal(select(accepted).files[0].text.length, text.length);
      const refused = imported(base.map(row => row._id === "pf_a" ? { ...row, protoText: text + "/" } : row));
      assert.throws(() => select(refused), /2 MiB per file/);
    } },
  ];
  const failures = [];
  for (const check of checks) {
    try { check.run(); } catch (error) { failures.push(new Error(check.name, { cause: error })); }
  }
  assert.deepEqual(clean.resources, cleanBefore, "Selection leaves imported resources unchanged");
  assert.deepEqual(unique.resources, uniqueBefore, "DFS selection leaves unique roots unchanged");
  assert.deepEqual(unsafe.resources, unsafeBefore, "Refusal leaves unsafe provenance unchanged");
  if (failures.length) throw new AggregateError(failures, "Proto root model regression failed");
  return { mode: "model-only", browser: false, native: false, network: false, passed: checks.map(check => check.name), importedResources: [clean.resources.length, unsafe.resources.length] };
}
