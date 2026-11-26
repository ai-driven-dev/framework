import type {
  NativeRegistrationAnswers,
  NativeRegistrationSection,
} from "../../contract/native-registration-spec.js";
import { MarketplaceRegistration } from "./marketplace-registration.js";
import { NativeActivation } from "./native-activation.js";

/** The native answers an assembled profile gives, its activation as the declaration it was built
 * from: the composition wires the host's own CLI and registries off it. */
export type AssembledNativeRegistration = Omit<NativeRegistrationAnswers, "nativeActivation"> & {
  nativeActivation(): NativeActivation | undefined;
  supportsUserScopeActivation(): boolean;
  machineLocalFiles(): readonly string[];
};

/** What assembling reads of a content profile: whether it reaches a user scope on its own, and
 * whether it takes plugins at all. */
interface ContentProfile {
  supportsUserScopeActivation(): boolean;
  plugins(): object | null;
}

/** A content profile assembled with its native-registration section. The content profile knows
 * nothing of the tool's own plugin CLI, so the answers that depend on it are given here. */
export function withNativeRegistration<P extends ContentProfile>(
  profile: P,
  section: NativeRegistrationSection
): P & AssembledNativeRegistration {
  const activation = section.activation && new NativeActivation(section.activation);
  const marketplace = section.marketplace
    ? new MarketplaceRegistration(section.marketplace, activation ?? null)
    : null;
  return {
    ...profile,
    nativeActivation: () => activation,
    pluginServer: () => section.pluginServer,
    marketplaceRegistration: () => marketplace,
    hostRefInUse: (enabled: boolean) => activation?.takesRefForInUse(enabled) ?? true,
    pluginEnablementIsMachineGlobal: () => activation?.scopesEnablement() !== true,
    supportsUserScopeActivation: () =>
      profile.supportsUserScopeActivation() ||
      ((activation !== undefined || section.pluginServer !== undefined) &&
        profile.plugins() !== null),
    machineLocalFiles: () => marketplace?.machineLocalFiles() ?? [],
  };
}
