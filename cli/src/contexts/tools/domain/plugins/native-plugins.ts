import { CapabilityConfigError } from "../../../../kernel/errors.js";
import type { PluginTranslationMode } from "../plugin-translation-mode.js";
import { MarketplaceRegistration } from "./marketplace-registration.js";
import { NativeActivation } from "./native-activation.js";
import {
  AS_SHIPPED,
  PluginDeliveryBase,
  type ProjectHooksPlacement,
  resolveProjectHooks,
} from "./plugin-delivery.js";
import type { HookScript, NativeParams } from "./plugin-params.js";

const DEFAULT_MCP_PATH = ".mcp.json";
const DEFAULT_HOOKS_PATH = "hooks/hooks.json";

/** A tool that installs a plugin into its own plugin directory and activates it natively. */
export class NativePlugins extends PluginDeliveryBase {
  readonly #pluginsDir: string;
  readonly #manifestRelativePath: string | null;
  readonly #hooksSupport: { accepts: boolean; unsupportedReason: string | null };
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
    if (params.pluginRootToken === undefined) {
      throw new CapabilityConfigError("native mode requires a pluginRootToken.");
    }
    this.#pluginRootToken = params.pluginRootToken;
    this.#pluginsDir = params.pluginsDir;
    this.#manifestRelativePath = params.pluginManifestRelativePath;
    this.#hooksSupport = {
      accepts: params.acceptsHooks,
      unsupportedReason: params.acceptsHooks ? null : params.hooksUnsupportedReason,
    };
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

  override translatesAsMarketplace(): boolean {
    return this.#translationMode === "marketplace";
  }
  override isNative(): boolean {
    return true;
  }
  override requiresUserScope(): boolean {
    return this.#installScope === "user";
  }
  override manifestPath(): string | null {
    return this.#manifestRelativePath;
  }
  override rootToken(): string {
    return this.#pluginRootToken;
  }
  hooksAcceptance(): { accepts: boolean; unsupportedReason: string | null } {
    return this.#hooksSupport;
  }
  override trustNotice(): string | null {
    return this.#hooksTrustNotice;
  }
  override activation(): NativeActivation | null {
    return this.#nativeActivation;
  }
  override marketplaceRegistration(): MarketplaceRegistration | null {
    return this.#registration;
  }
  override projectHooksDelivery(): ProjectHooksPlacement | null {
    return this.#projectHooks;
  }
  override mcpFile(): { accepts: boolean; relativePath: string } {
    return { accepts: this.#acceptsMcp, relativePath: this.#mcpRelativePath };
  }
  override hooksFilePath(): string {
    return this.#hooksRelativePath;
  }
  override hookScript(pluginPath: string, content: string): string {
    return this.#delivered(pluginPath, content);
  }
  override pluginOutputDir(pluginName: string): string {
    return `${this.#pluginsDir}${pluginName}/`;
  }
  override userPluginsBaseDir(homedir: string): string | null {
    return this.#userPluginsDir?.(homedir) ?? super.userPluginsBaseDir(homedir);
  }
}
