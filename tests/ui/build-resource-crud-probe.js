import { buildAuditedNativeProbe } from "./build-namespace-probe.js";
import { resourceCrudBuildIdentifier } from "./helpers/native-build-closure.js";
// Fixed isolated CRUD identity; same audited normal-hook producer as namespace.
if (import.meta.main)
  await buildAuditedNativeProbe(
    resourceCrudBuildIdentifier,
    process.argv[2] ?? "artifacts/native-resource-crud-audit-probe/current",
  );
