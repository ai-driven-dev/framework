import { ResolveBuiltMarketplaces } from "../../contexts/distribution/application/resolve-built-marketplaces.use-case.js";
import { InspectDeclaredMarketplaces } from "../../contexts/host-registration/application/inspect/inspect-declared-marketplaces.use-case.js";
import { InspectHostRegistration } from "../../contexts/host-registration/application/inspect/inspect-host-registration.use-case.js";
import { CheckFileReferences } from "../../contexts/installation/application/doctor/check-file-references.use-case.js";
import { CheckMergeFiles } from "../../contexts/installation/application/doctor/check-merge-files.use-case.js";
import { CheckPluginDrift } from "../../contexts/installation/application/doctor/check-plugin-drift.use-case.js";
import { CheckProjectLayout } from "../../contexts/installation/application/doctor/check-project-layout.use-case.js";
import { CheckTrackedFiles } from "../../contexts/installation/application/doctor/check-tracked-files.use-case.js";
import { ListRegisteredPlugins } from "../../contexts/installation/application/doctor/list-registered-plugins.use-case.js";
import { LoadManifest } from "../../contexts/installation/application/doctor/load-manifest.use-case.js";
import { LoadManifestForDoctor } from "../../contexts/installation/application/doctor/load-manifest-for-doctor.use-case.js";
import { CheckAuthentication } from "../../orchestration/doctor/check-authentication.use-case.js";
import { CheckRegistration } from "../../orchestration/doctor/check-registration.use-case.js";
import { RunDoctor } from "../../orchestration/doctor/run-doctor.use-case.js";
import { RunUserScopeDoctor } from "../../orchestration/doctor/run-user-scope-doctor.use-case.js";
import { doctorAll } from "../../orchestration/global/doctor-all.js";
import type { Installation } from "../installation.js";
import type { Base } from "../shared.js";
import { userConfigDir } from "../user-config-dir.js";

/** Whether the host CLI behind a binary is reachable, as the activator that drives it answers;
 * a binary no activator drives is not. */
export function hostBinaryAvailableIn(
  activators: ReadonlyMap<string, { isAvailable(): boolean }>
): (binary: string) => boolean {
  return (binary) => activators.get(binary)?.isAvailable() ?? false;
}

/** The registration check, over whichever manifest the scope reads. */
function registrationCheckOver(base: Base, inst: Installation, manifests: LoadManifest) {
  const { fs, tools } = base;
  return new CheckRegistration(
    {
      listPlugins: new ListRegisteredPlugins(manifests),
      records: inst.registrationRecordRules,
      builds: new ResolveBuiltMarketplaces({
        fs,
        registry: base.marketplaceRegistry,
        userCacheRoot: userConfigDir,
        currentVersion: base.currentVersionProvider,
      }),
      declared: new InspectDeclaredMarketplaces(
        fs,
        hostBinaryAvailableIn(base.nativePluginActivators),
        tools
      ),
      inspectHost: new InspectHostRegistration(
        {
          fs,
          pluginRegistries: base.hostPluginRegistries,
          marketplaceRegistries: base.hostMarketplaceRegistries,
          platform: process.platform,
        },
        tools
      ),
    },
    tools
  );
}

/** The doctor checks and the commands that run them. */
export function wireDoctor(base: Base, inst: Installation) {
  const { fs, tools } = base;
  const loadManifest = new LoadManifest(base.manifestRepo);
  const doctorUseCase = new RunDoctor(
    {
      load: new LoadManifestForDoctor(loadManifest),
      checks: {
        tracked: new CheckTrackedFiles(loadManifest, fs),
        merge: new CheckMergeFiles(loadManifest, fs),
        references: new CheckFileReferences(loadManifest, fs),
        layout: new CheckProjectLayout(loadManifest, fs, tools),
        plugin: new CheckPluginDrift(loadManifest, inst.detectPluginDriftUseCase),
      },
      registration: registrationCheckOver(base, inst, loadManifest),
      authentication: new CheckAuthentication(base.tokenProvider),
    },
    tools
  );
  // `doctor --scope user` checks the same registrations against the machine-wide manifest.
  const runUserScopeDoctor = new RunUserScopeDoctor(
    inst.readMachineInstallation,
    registrationCheckOver(base, inst, new LoadManifest(base.userManifestRepo))
  );
  const doctorAllUseCase = {
    execute: (projectRoot: string, pluginName?: string) =>
      doctorAll(doctorUseCase, projectRoot, pluginName),
  };
  return { doctorUseCase, runUserScopeDoctor, doctorAllUseCase };
}
