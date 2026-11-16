import { ResolveBuiltMarketplaces } from "../../contexts/distribution/application/resolve-built-marketplaces.js";
import { InspectDeclaredMarketplaces } from "../../contexts/host-registration/application/inspect/inspect-declared-marketplaces.js";
import { InspectHostRegistration } from "../../contexts/host-registration/application/inspect/inspect-host-registration.js";
import { CheckFileReferences } from "../../contexts/installation/application/doctor/check-file-references.js";
import { CheckMergeFiles } from "../../contexts/installation/application/doctor/check-merge-files.js";
import { CheckPluginDrift } from "../../contexts/installation/application/doctor/check-plugin-drift.js";
import { CheckProjectLayout } from "../../contexts/installation/application/doctor/check-project-layout.js";
import { CheckTrackedFiles } from "../../contexts/installation/application/doctor/check-tracked-files.js";
import { ListRegisteredPlugins } from "../../contexts/installation/application/doctor/list-registered-plugins.js";
import { LoadManifest } from "../../contexts/installation/application/doctor/load-manifest.js";
import { LoadManifestForDoctor } from "../../contexts/installation/application/doctor/load-manifest-for-doctor.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import { CheckRegistration } from "../../orchestration/doctor/check-registration.js";
import { RunDoctor } from "../../orchestration/doctor/run-doctor.js";
import { doctorAll } from "../../orchestration/global/doctor-all.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import type { Base } from "./base.js";
import type { Installation } from "./installation.js";

/** Whether the host CLI behind a binary is reachable, as the activator that drives it answers;
 * a binary no activator drives is not. */
export function hostBinaryAvailableIn(
  activators: ReadonlyMap<string, { isAvailable(): boolean }>
): (binary: string) => boolean {
  return (binary) => activators.get(binary)?.isAvailable() ?? false;
}

/** The doctor checks and the commands that run them. */
export function wireDoctor(base: Base, inst: Installation) {
  const {
    fs,
    hasher,
    tokenProvider,
    currentVersionProvider,
    manifestRepo,
    userManifestRepo,
    nativePluginActivators,
    hostMarketplaceRegistries,
    hostPluginRegistries,
    marketplaceRegistry,
  } = base;
  const { detectPluginDriftUseCase } = inst;
  const loadManifest = new LoadManifest(manifestRepo);
  const registrationOver = (manifests: LoadManifest) =>
    new CheckRegistration(
      new ListRegisteredPlugins(manifests),
      new ResolveBuiltMarketplaces(fs, marketplaceRegistry, userConfigDir, currentVersionProvider),
      new InspectDeclaredMarketplaces(fs, hostBinaryAvailableIn(nativePluginActivators)),
      new InspectHostRegistration(fs, hostPluginRegistries, hostMarketplaceRegistries)
    );
  const doctorUseCase = new RunDoctor(
    new LoadManifestForDoctor(loadManifest),
    {
      tracked: new CheckTrackedFiles(loadManifest, fs),
      merge: new CheckMergeFiles(loadManifest, fs, hasher),
      references: new CheckFileReferences(loadManifest, fs),
      layout: new CheckProjectLayout(loadManifest, fs, tokenProvider),
      plugin: new CheckPluginDrift(loadManifest, detectPluginDriftUseCase),
    },
    registrationOver(loadManifest)
  );
  // `doctor --scope user` checks the same registrations against the machine-wide manifest.
  const doctorRegistrationUseCase = registrationOver(new LoadManifest(userManifestRepo));
  const doctorAllUseCase = {
    execute: (projectRoot: string, tools: ToolCatalog, pluginName?: string) =>
      doctorAll(doctorUseCase, projectRoot, tools, pluginName),
  };
  return { doctorUseCase, doctorRegistrationUseCase, doctorAllUseCase };
}
