import { CapabilityConfigError } from "../../../../kernel/errors.js";
import type { MarketplaceSettings, MarketplaceSettingsInput } from "../marketplace-settings.js";
import type { NativeActivation } from "./native-activation.js";

/** Where and how a tool records the marketplaces it knows about, held only by a tool whose own
 * CLI drives the registration. */
export class MarketplaceRegistration {
  readonly #settings: MarketplaceSettings;

  constructor(settings: MarketplaceSettings, activation: NativeActivation | null) {
    if (activation === null) {
      throw new CapabilityConfigError(
        "marketplaceSettings requires a nativeActivation to drive the registration."
      );
    }
    this.#settings = settings;
  }

  /** The project file shared with teammates, where marketplaces are declared. */
  sharedSettingsFile(): string {
    return this.#settings.settingsPath;
  }

  /** The key the shared file declares marketplaces under. */
  marketplacesKey(): string {
    return this.#settings.settingsKey;
  }

  /** The key the shared file enables plugins under, when the tool writes one. */
  enabledPluginsKey(): string | undefined {
    return this.#settings.enabledPluginsKey;
  }

  /** The machine-local file the tool's registrations live in, or null when it keeps none. */
  localSettingsFile(): string | null {
    return this.#settings.marketplacesSettingsPath;
  }

  /** The name a marketplace is keyed by in the enabled-plugins map, or null when none is written. */
  entryKeyFor(input: MarketplaceSettingsInput): string | null {
    return this.#settings.toEntryKey(input);
  }

  /** Whether a declarative plugin entry may only be projected once the host proved the ref. */
  requiresNativeProof(): boolean {
    return this.#settings.declarativePluginActivationRequiresNativeProof === true;
  }

  /** The file this tool's registrations live in, when it has one of its own to keep out of
   * `status` and the gitignore; `null` means nowhere machine-local to write. */
  machineLocalFiles(): readonly string[] {
    const file = this.#settings.marketplacesSettingsPath;
    return file === null ? [] : [file];
  }
}
