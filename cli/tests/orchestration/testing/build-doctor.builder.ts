import type { InspectHostRegistrationDeps } from "../../../src/contexts/host-registration/application/inspect/inspect-host-registration.use-case.js";
import { CheckFileReferences } from "../../../src/contexts/installation/application/doctor/check-file-references.use-case.js";
import { CheckMergeFiles } from "../../../src/contexts/installation/application/doctor/check-merge-files.use-case.js";
import { CheckPluginDrift } from "../../../src/contexts/installation/application/doctor/check-plugin-drift.use-case.js";
import { CheckProjectLayout } from "../../../src/contexts/installation/application/doctor/check-project-layout.use-case.js";
import { CheckTrackedFiles } from "../../../src/contexts/installation/application/doctor/check-tracked-files.use-case.js";
import { LoadManifest } from "../../../src/contexts/installation/application/doctor/load-manifest.use-case.js";
import { LoadManifestForDoctor } from "../../../src/contexts/installation/application/doctor/load-manifest-for-doctor.use-case.js";
import { DetectPluginDrift } from "../../../src/contexts/installation/application/shared/detect-plugin-drift.use-case.js";
import { RunDoctor } from "../../../src/orchestration/doctor/run-doctor.use-case.js";
import type { buildInstallationDeps } from "../../shared/testing/installation-deps.builder.js";
import { registeredHostInspector } from "../../shared/testing/registered-host-inspector.builder.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { checkRegistrationOver } from "./build-check-registration.builder.js";

export function buildDoctorUseCase(
  deps: Awaited<ReturnType<typeof buildInstallationDeps>>,
  hostRegistries: InspectHostRegistrationDeps["pluginRegistries"] = new Map()
): RunDoctor {
  const loadManifest = new LoadManifest(deps.manifestRepo);
  return new RunDoctor(
    {
      load: new LoadManifestForDoctor(loadManifest),
      checks: {
        tracked: new CheckTrackedFiles(loadManifest, deps.fs),
        merge: new CheckMergeFiles(loadManifest, deps.fs),
        references: new CheckFileReferences(loadManifest, deps.fs),
        layout: new CheckProjectLayout(loadManifest, deps.fs, registeredTools()),
        plugin: new CheckPluginDrift(
          loadManifest,
          new DetectPluginDrift(deps.fs, registeredTools())
        ),
      },
      registration: checkRegistrationOver(
        loadManifest,
        deps.fs,
        deps.marketplaceRegistry,
        (binary) =>
          binary === TOOL.codex &&
          deps.nativePluginActivators.get(TOOL.codex)?.isAvailable() === true,
        registeredHostInspector(deps.fs, hostRegistries, new Map()),
        () => "/user-cache",
        { get: () => "1.0.0" },
        registeredTools()
      ),
      authentication: { execute: async () => [] },
    },
    registeredTools()
  );
}
