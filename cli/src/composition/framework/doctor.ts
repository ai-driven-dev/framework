import { DoctorLayoutUseCase } from "../../contexts/framework/application/doctor/doctor-layout-use-case.js";
import { DoctorMergeFilesUseCase } from "../../contexts/framework/application/doctor/doctor-merge-files-use-case.js";
import { DoctorPluginUseCase } from "../../contexts/framework/application/doctor/doctor-plugin-use-case.js";
import { DoctorReferencesUseCase } from "../../contexts/framework/application/doctor/doctor-references-use-case.js";
import { DoctorRegistrationUseCase } from "../../contexts/framework/application/doctor/doctor-registration-use-case.js";
import { DoctorTrackedFilesUseCase } from "../../contexts/framework/application/doctor/doctor-tracked-files-use-case.js";
import { DoctorUseCase } from "../../contexts/framework/application/doctor/doctor-use-case.js";
import { DoctorAllUseCase } from "../../contexts/framework/application/global/doctor-all-use-case.js";
import { InspectHostRegistration } from "../../contexts/host-registration/application/inspect-host-registration.js";
import { userConfigDir } from "../../shared/infrastructure/user-config-dir.js";
import type { Base } from "./base.js";
import type { Installation } from "./installation.js";

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
  const doctorTrackedFilesUseCase = new DoctorTrackedFilesUseCase(fs);
  const doctorMergeFilesUseCase = new DoctorMergeFilesUseCase(fs, hasher);
  const doctorPluginUseCase = new DoctorPluginUseCase(detectPluginDriftUseCase);
  const doctorReferencesUseCase = new DoctorReferencesUseCase(fs);
  const doctorLayoutUseCase = new DoctorLayoutUseCase(fs, tokenProvider);
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
  const doctorUseCase = new DoctorUseCase(
    manifestRepo,
    doctorTrackedFilesUseCase,
    doctorMergeFilesUseCase,
    doctorPluginUseCase,
    doctorReferencesUseCase,
    doctorLayoutUseCase,
    doctorRegistrationUseCase
  );
  const doctorAllUseCase = new DoctorAllUseCase(doctorUseCase);
  return { doctorUseCase, doctorRegistrationUseCase, doctorAllUseCase };
}
