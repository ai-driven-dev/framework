import { CapabilityConfigError } from "../../../../kernel/errors.js";
import type { MarketplaceSettings, MarketplaceSettingsInput } from "../marketplace-settings.js";
import type { NativeActivation } from "./native-activation.js";

/** Where and how a tool records the marketplaces it knows about, held only by a tool whose own
 * CLI drives the registration. */
export class MarketplaceRegistration implements MarketplaceSettings {
  readonly settingsPath: string;
  readonly settingsKey: string;
  declare readonly enabledPluginsKey?: string;
  declare readonly declarativePluginActivationRequiresNativeProof?: boolean;
  readonly marketplacesSettingsPath: string | null;
  readonly toEntryKey: (input: MarketplaceSettingsInput) => string | null;

  constructor(settings: MarketplaceSettings, activation: NativeActivation | null) {
    if (activation === null) {
      throw new CapabilityConfigError(
        "marketplaceSettings requires a nativeActivation to drive the registration."
      );
    }
    this.settingsPath = settings.settingsPath;
    this.settingsKey = settings.settingsKey;
    this.marketplacesSettingsPath = settings.marketplacesSettingsPath;
    this.toEntryKey = settings.toEntryKey;
    Object.assign(this, settings);
  }
}
