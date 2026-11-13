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

  /** Takes the marketplaces declaration out of a parsed shared file; whether one was there. */
  dropMarketplaces(shared: Record<string, unknown>): boolean {
    const key = this.#settings.settingsKey;
    if (!(key in shared)) return false;
    delete shared[key];
    return true;
  }

  /** The marketplace names a parsed settings file declares, whether as a list or as a map. */
  declaredMarketplaceNames(parsed: unknown): Set<string> {
    if (parsed === null || typeof parsed !== "object") return new Set();
    const value = (parsed as Record<string, unknown>)[this.#settings.settingsKey];
    if (Array.isArray(value)) return new Set(value.map(String));
    if (value !== null && typeof value === "object") return new Set(Object.keys(value));
    return new Set();
  }

  /** Whether the tool enables plugins in the shared file. */
  writesEnabledPlugins(): boolean {
    return this.#settings.enabledPluginsKey != null;
  }

  /** The enabled-plugins map a parsed shared file holds, empty when absent or not a map. */
  enabledPluginsIn(shared: Record<string, unknown>): Record<string, unknown> {
    const key = this.#settings.enabledPluginsKey;
    const raw = key === undefined ? undefined : shared[key];
    return raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  }

  /** Sets the enabled-plugins map of a parsed shared file; nothing when the tool writes none. */
  recordEnabledPlugins(shared: Record<string, unknown>, entries: Record<string, unknown>): void {
    const key = this.#settings.enabledPluginsKey;
    if (key != null) shared[key] = entries;
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
