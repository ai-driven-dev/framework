import { CapabilityConfigError } from "../../../../kernel/errors.js";
import type { MarketplaceSettingsInput } from "../../contract/tool-vocabulary.js";
import type { MarketplaceSettings } from "./marketplace-settings.js";
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

  /** A parsed shared file without its marketplaces declaration, or null when it declared none. */
  withoutMarketplaces(shared: Record<string, unknown>): Record<string, unknown> | null {
    const key = this.#settings.settingsKey;
    if (!(key in shared)) return null;
    const rest = { ...shared };
    delete rest[key];
    return rest;
  }

  /** The marketplace names a parsed settings file declares, whether as a list or as a map. */
  declaredMarketplaceNames(parsed: unknown): Set<string> {
    if (parsed === null || typeof parsed !== "object") return new Set();
    const value = (parsed as Record<string, unknown>)[this.#settings.settingsKey];
    if (Array.isArray(value)) return new Set(value.map(String));
    if (value !== null && typeof value === "object") return new Set(Object.keys(value));
    return new Set();
  }

  /** A parsed shared file with each ref not yet enabled added as enabled, or null when there is
   * nothing to add: every ref already there, or a tool that enables no plugin in this file. */
  withEnabledPlugins(
    shared: Record<string, unknown>,
    refs: readonly string[]
  ): Record<string, unknown> | null {
    const key = this.#settings.enabledPluginsKey;
    if (key == null) return null;
    const raw = shared[key];
    const existing =
      raw !== null && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const toAdd: Record<string, boolean> = {};
    for (const ref of refs) if (!(ref in existing)) toAdd[ref] = true;
    if (Object.keys(toAdd).length === 0) return null;
    return { ...shared, [key]: { ...existing, ...toAdd } };
  }

  /** The name a marketplace is keyed by in the enabled-plugins map, or null when the tool cannot
   * express its source. */
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
