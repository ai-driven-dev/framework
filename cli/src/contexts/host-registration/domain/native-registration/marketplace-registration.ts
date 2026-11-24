import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { MarketplaceSettingsInput } from "../../../tools/contract/tool-vocabulary.js";
import { NativeRegistrationConfigError } from "../../contract/host-registration.error.js";
import type {
  MarketplaceRegistrationAnswers,
  MarketplaceSettings,
} from "../../contract/native-registration-spec.js";
import type { NativeActivation } from "./native-activation.js";

/** Where and how a tool records the marketplaces it knows about, held only by a tool whose own
 * CLI drives the registration. */
export class MarketplaceRegistration implements MarketplaceRegistrationAnswers {
  readonly #settings: MarketplaceSettings;

  constructor(settings: MarketplaceSettings, activation: NativeActivation | null) {
    if (activation === null) {
      throw new NativeRegistrationConfigError(
        "marketplaceSettings requires a nativeActivation to drive the registration."
      );
    }
    this.#settings = settings;
  }

  /** The project file shared with teammates, where marketplaces are declared. */
  sharedSettingsFile(): string {
    return this.#settings.settingsPath;
  }

  /** The key under which a shared file declares its marketplaces. */
  marketplacesKey(): string {
    return this.#settings.settingsKey;
  }

  /** The key under which a shared file enables plugins, or null for a tool that enables none
   * there. */
  enabledPluginsKey(): string | null {
    return this.#settings.enabledPluginsKey ?? null;
  }

  /** The marketplace names a parsed settings file declares, whether as a list or as a map. */
  declaredMarketplaceNames(parsed: unknown): Set<string> {
    const value = asPlainObject(parsed)?.[this.#settings.settingsKey];
    if (Array.isArray(value)) return new Set(value.map(String));
    if (value !== null && typeof value === "object") return new Set(Object.keys(value));
    return new Set();
  }

  /** The directory each declared marketplace names as its source; a list or an entry with no
   * path names none. */
  declaredMarketplaceSources(parsed: unknown): Map<string, string> {
    const declared = asPlainObject(asPlainObject(parsed)?.[this.#settings.settingsKey]);
    const sources = new Map<string, string>();
    for (const [name, entry] of Object.entries(declared ?? {})) {
      const path = asPlainObject(asPlainObject(entry)?.source)?.path;
      if (typeof path === "string") sources.set(name, path);
    }
    return sources;
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
