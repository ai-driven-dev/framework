import { DoctorRegistrationUseCase } from "../../contexts/framework/application/doctor/doctor-registration-use-case.js";
import { DoctorAllUseCase } from "../../contexts/framework/application/global/doctor-all-use-case.js";
import { InspectHostRegistration } from "../../contexts/host-registration/application/inspect-host-registration.js";
import { CheckFileReferences } from "../../contexts/installation/application/doctor/check-file-references.js";
import { CheckMergeFiles } from "../../contexts/installation/application/doctor/check-merge-files.js";
import { CheckPluginDrift } from "../../contexts/installation/application/doctor/check-plugin-drift.js";
import { CheckProjectLayout } from "../../contexts/installation/application/doctor/check-project-layout.js";
import { CheckTrackedFiles } from "../../contexts/installation/application/doctor/check-tracked-files.js";
import { LoadManifest } from "../../contexts/installation/application/doctor/load-manifest.js";
import { LoadManifestForDoctor } from "../../contexts/installation/application/doctor/load-manifest-for-doctor.js";
import { type CheckRegistration, RunDoctor } from "../../orchestration/doctor/run-doctor.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import type { Base } from "./base.js";
import type { Installation } from "./installation.js";

/** Hands the installation's manifest to the registration check, until that check reads the
 * registered plugins from installation itself. */
export function registrationOver(
  loadManifest: LoadManifest,
  registration: DoctorRegistrationUseCase
): CheckRegistration {
  return {
    execute: async (command) =>
      registration.execute({ ...command, manifest: await loadManifest.execute() }),
  };
}

/** The doctor checks and the commands that run them. */
export function wireDoctor(base: Base, inst: Installation) {
  const {
    fs,
    hasher,
    tokenProvider,
    currentVersionProvider,
    manifestRepo,
    nativePluginActivators,
    hostMarketplaceRegistries,
    hostPluginRegistries,
    marketplaceRegistry,
  } = base;
  const { detectPluginDriftUseCase } = inst;
  const loadManifest = new LoadManifest(manifestRepo);
  const checkTrackedFiles = new CheckTrackedFiles(loadManifest, fs);
  const checkMergeFiles = new CheckMergeFiles(loadManifest, fs, hasher);
  const checkPluginDrift = new CheckPluginDrift(loadManifest, detectPluginDriftUseCase);
  const checkFileReferences = new CheckFileReferences(loadManifest, fs);
  const checkProjectLayout = new CheckProjectLayout(loadManifest, fs, tokenProvider);
  // Named so `doctor --scope user` reuses this instance: the check takes its manifest and
  // project root per call, so nothing about it is project-scope-specific.
  const doctorRegistrationUseCase = new DoctorRegistrationUseCase(
    fs,
    marketplaceRegistry,
    (binary) => nativePluginActivators.get(binary)?.isAvailable() ?? false,
    new InspectHostRegistration(fs, hostPluginRegistries, hostMarketplaceRegistries),
    userConfigDir,
    currentVersionProvider
  );
  const doctorUseCase = new RunDoctor(
    new LoadManifestForDoctor(loadManifest),
    {
      tracked: checkTrackedFiles,
      merge: checkMergeFiles,
      references: checkFileReferences,
      layout: checkProjectLayout,
      plugin: checkPluginDrift,
    },
    registrationOver(loadManifest, doctorRegistrationUseCase)
  );
  const doctorAllUseCase = new DoctorAllUseCase(doctorUseCase);
  return { doctorUseCase, doctorRegistrationUseCase, doctorAllUseCase };
}
