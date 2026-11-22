import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { CheckFileReferences } from "../../../src/contexts/installation/application/doctor/check-file-references.use-case.js";
import { CheckMergeFiles } from "../../../src/contexts/installation/application/doctor/check-merge-files.use-case.js";
import { CheckPluginDrift } from "../../../src/contexts/installation/application/doctor/check-plugin-drift.use-case.js";
import { CheckProjectLayout } from "../../../src/contexts/installation/application/doctor/check-project-layout.use-case.js";
import { CheckTrackedFiles } from "../../../src/contexts/installation/application/doctor/check-tracked-files.use-case.js";
import { LoadManifest } from "../../../src/contexts/installation/application/doctor/load-manifest.use-case.js";
import { LoadManifestForDoctor } from "../../../src/contexts/installation/application/doctor/load-manifest-for-doctor.use-case.js";
import { DetectPluginDrift } from "../../../src/contexts/installation/application/shared/detect-plugin-drift.use-case.js";
import { RunDoctor } from "../../../src/orchestration/doctor/run-doctor.use-case.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { hostInspector } from "../../shared/testing/host-inspector.builder.js";
import type { buildInstallationDeps } from "../../shared/testing/installation-deps.builder.js";
import { checkRegistrationOver } from "./build-check-registration.builder.js";

export function buildRunDoctor(
  deps: Awaited<ReturnType<typeof buildInstallationDeps>>,
  hostRegistries: ReadonlyMap<AiToolId, HostPluginRegistry> = new Map()
): RunDoctor {
  const loadManifest = new LoadManifest(deps.manifestRepo);
  return new RunDoctor(
    {
      load: new LoadManifestForDoctor(loadManifest),
      checks: {
        tracked: new CheckTrackedFiles(loadManifest, deps.fs),
        merge: new CheckMergeFiles(loadManifest, deps.fs),
        references: new CheckFileReferences(loadManifest, deps.fs),
        layout: new CheckProjectLayout(loadManifest, deps.fs, deps.tools),
        plugin: new CheckPluginDrift(
          loadManifest,
          new DetectPluginDrift(deps.fs, deps.tools, () => "/home/dev")
        ),
      },
      registration: checkRegistrationOver(
        loadManifest,
        deps.fs,
        deps.marketplaceRegistry,
        (binary) =>
          [...deps.nativePluginActivators].some(
            ([id, activator]) => id === binary && activator.isAvailable()
          ),
        hostInspector(deps.tools, {
          fs: deps.fs,
          pluginRegistries: hostRegistries,
          marketplaceRegistries: new Map(),
        }),
        () => "/user-cache",
        "1.0.0",
        deps.tools
      ),
      authentication: { execute: async () => [] },
    },
    deps.tools
  );
}
