import arrival from "../fixtures/grpc-reflection-arrival-reference.json" with { type: "json" };
import graph from "../fixtures/grpc-reflection-graph-reference.json" with { type: "json" };
import { profileGrpcFrame } from "./grpc-reflection-profile-case-data.js";

/** @param {{bytes:string}[]} files */
function descriptorSet(files) {
  return Buffer.concat(
    files.map((file) => {
      const bytes = Buffer.from(file.bytes, "base64"),
        length = [];
      let size = bytes.length;
      do {
        length.push((size % 128) | (size >= 128 ? 128 : 0));
        size = Math.floor(size / 128);
      } while (size);
      return Buffer.concat([Buffer.from([10, ...length]), bytes]);
    }),
  ).toString("base64");
}
/** @type {Map<string,Record<string,any>>} */
const cases = new Map();
for (const [fixture, graphCase] of [
  [arrival, false],
  [graph, true],
]) {
  for (const row of /** @type {any} */ (fixture).rows) {
    const mode = "legacy-arrival-" + (cases.size + 1);
    const service = graphCase
      ? "ownedgraph.main.Entry"
      : "ownedarrival.root.Entry";
    const cache = graphCase
      ? row.label.startsWith("cached-")
        ? ["ownedgraph.seed.Seed"]
        : []
      : row.cache === "both"
        ? ["ownedarrival.left.Seed", "ownedarrival.right.Seed"]
        : row.cache === "none"
          ? []
          : ["ownedarrival." + row.cache + ".Seed"];
    const groups = Object.fromEntries(
      cache.map((name) => [
        name,
        graphCase
          ? ["seed.proto", "any.proto", "c.proto", "d.proto", "e.proto"]
          : [
              name.includes(".left.") ? "left.proto" : "right.proto",
              "any.proto",
            ],
      ]),
    );
    groups[service] = ["main.proto", "any.proto"];
    // Main import declaration order differs between oracle rows.
    const set = graphCase
      ? descriptorSet(/** @type {any} */ (fixture).files)
      : row.descriptorSet;
    cases.set(mode, {
      mode,
      reflection: true,
      jsonMode: "legacy",
      unary: true,
      receives: true,
      editor: true,
      showNotice: false,
      service,
      services: [...cache, service],
      discoveryFileGroups: groups,
      omitPreviouslySent: true,
      descriptorSet: set,
      body: row.body,
      formattedBody: JSON.stringify(JSON.parse(row.body), null, 2),
      wire: profileGrpcFrame(Buffer.from(row.wireHex, "hex")),
      responseText: row.json,
      preview: JSON.stringify(JSON.parse(row.json), null, 2),
      method: "/" + service + "/Call",
      referenceLabel: row.label,
      expectedServiceFiles: row.fileOrder,
      arrivalPlan: {
        graph: graphCase,
        arrival: row.arrival,
        label: row.label,
        seedServices: cache,
      },
    });
  }
}
export const grpcReflectionArrivalModes = [...cases.keys()];
/** @param {string} mode @returns {Record<string,any>} */
export function grpcReflectionArrivalCase(mode) {
  const value = cases.get(mode);
  if (!value) throw Error("Unknown reflection arrival case " + mode);
  return value;
}
