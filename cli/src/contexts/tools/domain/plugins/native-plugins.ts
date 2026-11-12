import { CapabilityConfigError } from "../../../../kernel/errors.js";
import type { HooksAcceptance } from "../../contract/tool-profile.js";
import type { HookScript, PluginTranslationMode } from "../../contract/tool-vocabulary.js";
import { MarketplaceRegistration } from "./marketplace-registration.js";
import { NativeActivation } from "./native-activation.js";
import {
  AS_SHIPPED,
  PluginDeliveryBase,
  type ProjectHooksPlacement,
  resolveProjectHooks,
} from "./plugin-delivery.js";
import type { NativeParams } from "./plugin-params.js";

const DEFAULT_MCP_PATH = ".mcp.json";
const DEFAULT_HOOKS_PATH = "hooks/hooks.json";

/** A tool that installs a plugin into its own plugin directory and activates it natively. */
export class NativePlugins extends PluginDeliveryBase {
  readonly #pluginsDir: string;
  readonly #manifestRelativePath: string | null;
  readonly #hooksSupport: HooksAcceptance;
  readonly #hooksTrustNotice: string | null;
  readonly #pluginRootToken: string;
  readonly #acceptsMcp: boolean;
  readonly #mcpRelativePath: string;
  readonly #hooksRelativePath: string;
  readonly #projectHooks: ProjectHooksPlacement | null;
  readonly #delivered: HookScript;
  readonly #nativeActivation: NativeActivation | null;
  readonly #registration: MarketplaceRegistration | null;
  readonly #translationMode: PluginTranslationMode | null;
  readonly #installScope: "project" | "user";
  readonly #userPluginsDir?: (homedir: string) => string;

  constructor(params: NativeParams) {
    super(params.globalFiles ?? null);
    this.#installScope = params.installScope ?? "project";
    if (params.installScope === "user" && params.userPluginsDir === undefined) {
      throw new CapabilityConfigError(
        "installScope 'user' requires a userPluginsDir resolver function."
      );
    }
    this.#delivered = params.hookScript ?? AS_SHIPPED;
    this.#projectHooks = params.acceptsHooks ? resolveProjectHooks(params, this.#delivered) : null;
    this.#pluginRootToken = params.pluginRootToken;
    this.#pluginsDir = params.pluginsDir;
    this.#manifestRelativePath = params.pluginManifestRelativePath;
    this.#hooksSupport = params.acceptsHooks
      ? { accepts: true }
      : { accepts: false, reason: params.hooksUnsupportedReason };
    this.#hooksTrustNotice = params.acceptsHooks ? (params.hooksTrustNotice ?? null) : null;
    this.#acceptsMcp = params.acceptsMcp ?? false;
    this.#mcpRelativePath = params.mcpRelativePath ?? DEFAULT_MCP_PATH;
    this.#hooksRelativePath = params.hooksRelativePath ?? DEFAULT_HOOKS_PATH;
    this.#nativeActivation =
      params.nativeActivation === undefined ? null : new NativeActivation(params.nativeActivation);
    this.#registration =
      params.marketplaceSettings === undefined
        ? null
        : new MarketplaceRegistration(params.marketplaceSettings, this.#nativeActivation);
    this.#translationMode = params.translationMode ?? null;
    this.#userPluginsDir = params.userPluginsDir;
  }

  get kind(): "native" {
    return "native";
  }
  translatesAsMarketplace(): boolean {
    return this.#translationMode === "marketplace";
  }
  override requiresUserScope(): boolean {
    return this.#installScope === "user";
  }
  manifestPath(): string | null {
    return this.#manifestRelativePath;
  }
  rootToken(): string {
    return this.#pluginRootToken;
  }
  hooksAcceptance(): HooksAcceptance {
    return this.#hooksSupport;
  }
  trustNotice(): string | null {
    return this.#hooksTrustNotice;
  }
  activation(): NativeActivation | null {
    return this.#nativeActivation;
  }
  marketplaceRegistration(): MarketplaceRegistration | null {
    return this.#registration;
  }
  projectHooksDelivery(): ProjectHooksPlacement | null {
    return this.#projectHooks;
  }
  /** Whether the tool takes a plugin's MCP file, and where it lands in the plugin directory. */
  mcpFile(): { accepts: boolean; relativePath: string } {
    return { accepts: this.#acceptsMcp, relativePath: this.#mcpRelativePath };
  }
  /** Where the plugin's hooks manifest lands in the plugin directory. */
  hooksFilePath(): string {
    return this.#hooksRelativePath;
  }
  hookScript(pluginPath: string, content: string): string {
    return this.#delivered(pluginPath, content);
  }
  pluginOutputDir(pluginName: string): string {
    return `${this.#pluginsDir}${pluginName}/`;
  }
  override copiesFilesGlobally(): boolean {
    return this.requiresUserScope() || super.copiesFilesGlobally();
  }
  override supportsUserScopeActivation(): boolean {
    return (
      this.#nativeActivation !== null ||
      this.requiresUserScope() ||
      super.supportsUserScopeActivation()
    );
  }
  /** Whether enabling a plugin acts on the whole machine: the tool declares no scope arguments. */
  enablementIsMachineGlobal(): boolean {
    return this.#nativeActivation?.scopesEnablement() !== true;
  }
  override userPluginsBaseDir(homedir: string): string | null {
    return this.#userPluginsDir?.(homedir) ?? super.userPluginsBaseDir(homedir);
  }
}
