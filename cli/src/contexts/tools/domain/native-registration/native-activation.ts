import type {
  MarketplaceRegistryLayout,
  NativeActivationSpec,
  PluginRegistryLayout,
} from "../../contract/native-registration-spec.js";
import type { EnvironmentReader, NativeActivationAnswers } from "../../contract/tool-profile.js";
import { CapabilityConfigError } from "../tools.error.js";

/** Where a host's registry sits for one home, and the layout its file is read as. */
export interface HostRegistryPlacement<Layout extends string> {
  readonly path: string;
  readonly layout: Layout;
}

/** What the host's own CLI is driven with: the verbs and arguments that differ between hosts. */
export type NativeCliShape = Pick<
  NativeActivationSpec,
  | "scopeArgs"
  | "userRemoveArgs"
  | "forceRemoveArgs"
  | "sourceCheckVerb"
  | "upgradeVerb"
  | "updateVerb"
  | "enableVerb"
  | "disableVerb"
  | "pluginArgs"
>;

/** A tool's native activation, asked and never read: every stored value sits behind an answer. */
export class NativeActivation implements NativeActivationAnswers {
  readonly #spec: NativeActivationSpec;

  constructor(spec: NativeActivationSpec) {
    if (spec.binary === "")
      throw new CapabilityConfigError("A native activation declares an empty binary");
    if (spec.marketplaceSources?.from === "marketplace-registry" && !spec.marketplaceRegistry)
      throw new CapabilityConfigError(
        "A native activation reads its marketplace sources from a registry it does not declare"
      );
    this.#spec = spec;
  }

  /** The host's executable, which also keys the matching `HostActions`. */
  hostBinary(): string {
    return this.#spec.binary;
  }

  /** The verbs and arguments the host's CLI is driven with. */
  cliShape(): NativeCliShape {
    const spec = this.#spec;
    return {
      scopeArgs: spec.scopeArgs,
      userRemoveArgs: spec.userRemoveArgs,
      forceRemoveArgs: spec.forceRemoveArgs,
      sourceCheckVerb: spec.sourceCheckVerb,
      upgradeVerb: spec.upgradeVerb,
      updateVerb: spec.updateVerb,
      enableVerb: spec.enableVerb,
      disableVerb: spec.disableVerb,
      pluginArgs: spec.pluginArgs,
    };
  }

  /** Where the host's plugin registry sits for this home and how it is read, when it was measured. */
  pluginRegistryAt(home: string): HostRegistryPlacement<PluginRegistryLayout> | undefined {
    const declared = this.#spec.pluginRegistry;
    return declared && { path: declared.location(home), layout: declared.layout };
  }

  /** Where the host's marketplace registry sits for this home and how it is read, when it keeps one. */
  marketplaceRegistryAt(
    home: string
  ): HostRegistryPlacement<MarketplaceRegistryLayout> | undefined {
    const declared = this.#spec.marketplaceRegistry;
    return declared && { path: declared.location(home), layout: declared.layout };
  }

  /** Whether the host's own CLI takes a scope for enabling a plugin. */
  scopesEnablement(): boolean {
    return this.#spec.scopeArgs !== undefined;
  }

  /** Where a marketplace's current source is read from, when the host has a witness. */
  marketplaceSourcesDeclaration(): NativeActivationSpec["marketplaceSources"] {
    return this.#spec.marketplaceSources;
  }

  /** Whether the host keeps a registry of marketplaces that this CLI can read. */
  keepsMarketplaceRegistry(): boolean {
    return this.#spec.marketplaceRegistry !== undefined;
  }

  /** Whether the host's own CLI can update one installed plugin ref. */
  refreshesOnePlugin(): boolean {
    return this.#spec.updateVerb !== undefined;
  }

  /** Where the host leaves its plugin cache after an uninstall, or undefined when it declares none. */
  pluginCacheRoot(home: string): string | undefined {
    return this.#spec.pluginCacheDir?.(home);
  }

  /** The host's own user-scope settings file, or undefined when none is declared. */
  userSettingsFile(home: string, env: EnvironmentReader): string | undefined {
    return this.#spec.userSettingsPath?.(home, env);
  }

  /** Whether a plugin ref stays in use. A host that keeps an uninstalled ref, disabled, makes a
   * disabled ref indistinguishable from one the person disabled, so only an enabled one counts. */
  takesRefForInUse(enabled: boolean): boolean {
    return enabled || this.#spec.uninstallLeavesRefDisabled !== true;
  }
}
