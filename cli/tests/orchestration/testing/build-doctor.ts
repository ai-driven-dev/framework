import type { InspectHostRegistration } from "../../../src/contexts/host-registration/application/inspect/inspect-host-registration.js";
import { CheckFileReferences } from "../../../src/contexts/installation/application/doctor/check-file-references.js";
import { CheckMergeFiles } from "../../../src/contexts/installation/application/doctor/check-merge-files.js";
import { CheckPluginDrift } from "../../../src/contexts/installation/application/doctor/check-plugin-drift.js";
import { CheckProjectLayout } from "../../../src/contexts/installation/application/doctor/check-project-layout.js";
import { CheckTrackedFiles } from "../../../src/contexts/installation/application/doctor/check-tracked-files.js";
import { LoadManifest } from "../../../src/contexts/installation/application/doctor/load-manifest.js";
import { LoadManifestForDoctor } from "../../../src/contexts/installation/application/doctor/load-manifest-for-doctor.js";
import { DetectPluginDrift } from "../../../src/contexts/installation/application/shared/detect-plugin-drift.js";
import { RunDoctor } from "../../../src/orchestration/doctor/run-doctor.js";
import type { buildInstallationDeps } from "../../contexts/installation/testing/installation-deps.builder.js";
import { registeredHostInspector } from "../../helpers/ports/registered-host-inspector.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import { checkRegistrationOver } from "./build-check-registration.js";

export function buildDoctorUseCase(
  deps: Awaited<ReturnType<typeof buildInstallationDeps>>,
  hostRegistries: ConstructorParameters<typeof InspectHostRegistration>[1] = new Map()
): RunDoctor {
  const loadManifest = new LoadManifest(deps.manifestRepo);
  return new RunDoctor(
    new LoadManifestForDoctor(loadManifest),
    {
      tracked: new CheckTrackedFiles(loadManifest, deps.fs),
      merge: new CheckMergeFiles(loadManifest, deps.fs),
      references: new CheckFileReferences(loadManifest, deps.fs),
      layout: new CheckProjectLayout(loadManifest, deps.fs, registeredTools()),
      plugin: new CheckPluginDrift(loadManifest, new DetectPluginDrift(deps.fs, registeredTools())),
    },
    checkRegistrationOver(
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
    { execute: async () => [] },
    registeredTools()
  );
}
