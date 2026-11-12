import type { FlatHooksLoaderEntry } from "../../../../kernel/materialization/flat-paths.js";
import type { FlatHooksBridge } from "../../contract/build-contract.js";
import type { FlatSkillLayout } from "../../contract/tool-profile.js";
import type {
  GlobalFiles,
  HookScript,
  PluginTranslationMode,
} from "../../contract/tool-vocabulary.js";
import type { MarketplaceSettings } from "../native-registration/marketplace-settings.js";
import type { NativeActivationSpec } from "../native-registration/native-activation.js";
import type {
  BridgeDelivery,
  HooksFlatPart,
  NoDelivery,
  PluginFileDelivery,
  ProjectHooksDelivery,
  ProjectMergeDelivery,
} from "../sections/hooks-section.js";
import type { McpPluginPart } from "../sections/mcp-section.js";

/**
 * The global-file mapping of a flat tool whose user configuration directory takes the same
 * `skills/` and `agents/` its project directory does (OpenCode, Kilo): a plugin's skills and
 * agents under `directory` keep their path below it. Hooks, commands and MCP entries stay
 * project-scoped.
 */
export function flatGlobalFilePath(directory: string): GlobalFiles["map"] {
  return (builtPath, plugin) => {
    if (!builtPath.startsWith(directory)) return null;
    const relative = builtPath.slice(directory.length);
    if (relative.startsWith(`skills/${plugin.name}/`)) return relative;
    const agent = /^agents\/(.+)\.md$/.exec(relative)?.[1];
    if (agent === undefined || !agent.startsWith(`${plugin.name}-`)) return null;
    return plugin.agents.has(agent.slice(plugin.name.length + 1)) ? relative : null;
  };
}

/** Shared by every mode: where a tool's machine-scope files go, when it has any. */
interface GlobalFilesParams {
  globalFiles?: GlobalFiles;
}

export interface NativePluginsParams extends ProjectHooksDelivery {
  mode: "native";
  pluginsDir: string;
  /** Set to `null` to suppress writing a plugin manifest file into the plugin directory. */
  pluginManifestRelativePath: string | null;
  hooksRelativePath?: string;
  /** The MCP file a plugin delivers, when the tool takes one. */
  mcp?: McpPluginPart;
  /** The variable this tool expands to the installed plugin's directory, as written in a
   * hook or MCP command. */
  pluginRootToken: string;
  /** See {@link NativePlugins.hookScript}. */
  hookScript?: HookScript;
  marketplaceSettings?: MarketplaceSettings;
  /** Enables native CLI-driven plugin activation. See {@link NativeActivationSpec}. */
  nativeActivation?: NativeActivationSpec;
  /** Pass `"marketplace"` alongside `marketplaceSettings` for Mode A routing. Defaults to
   * `null`, neutral native, where no translation strategy applies. */
  translationMode?: PluginTranslationMode;
  /** `"user"` installs plugins relative to the home directory and requires `userPluginsDir`;
   * defaults to `"project"`. */
  installScope?: "project" | "user";
  /** Absolute user-scope plugins base directory, given a homedir. Required when
   * `installScope === "user"`. */
  userPluginsDir?: (homedir: string) => string;
}

export type FlatHooksSupport =
  | ({
      acceptsHooks: true;
      flatHooksDir: string;
      /**
       * The loader's own plugin module: the runtime the loader itself imports, not a script
       * a bridge must be told to run. Omit where the loader has no such convention.
       */
      flatHooksLoaderEntry?: FlatHooksLoaderEntry;
      /** See {@link FlatHooksBridge}. Omit when this loader triggers a plugin's hooks some
       * other way. */
      flatHooksBridge?: FlatHooksBridge;
      /** See {@link FlatPlugins.hookScript}. */
      hookScript?: HookScript;
    } & ProjectHooksDelivery)
  | { acceptsHooks: false; hooksUnsupportedReason: string };

export type FlatPluginsParams = {
  mode: "flat";
  flatNamespacePrefix: string;
  flatSkillLayout?: FlatSkillLayout;
} & FlatHooksSupport;

export interface UnsupportedPluginsParams {
  mode: "unsupported";
  /** See {@link FlatPluginsParams.hooksUnsupportedReason}. */
  hooksUnsupportedReason: string;
}

/**
 * Whether this tool runs the hooks a plugin ships. Stated, never defaulted: a tool nobody
 * considered loses its hooks quietly when the field falls back to `false`.
 * `hooksTrustNotice` is the opposite case — the tool runs a delivered hook, but only once a
 * per-hook trust a headless run is never prompted for is granted (measured on Codex: four
 * clean `codex exec` sessions ran none of the hooks until `--dangerously-bypass-hook-trust` did).
 */
export type HooksSupport =
  | { acceptsHooks: true; hooksTrustNotice?: string }
  | { acceptsHooks: false; hooksUnsupportedReason: string };

export type NativeParams = NativePluginsParams & HooksSupport & GlobalFilesParams;
export type FlatParams = FlatPluginsParams & GlobalFilesParams;
export type UnsupportedParams = UnsupportedPluginsParams & GlobalFilesParams;

export type PluginsParams = NativeParams | FlatParams | UnsupportedParams;

type HooksParamsHead = {
  acceptsHooks: true;
  hooksTrustNotice?: string;
  hookScript?: HookScript;
};

function refusal(delivery: NoDelivery): { acceptsHooks: false; hooksUnsupportedReason: string } {
  return { acceptsHooks: false, hooksUnsupportedReason: delivery.reason };
}

/** A native tool's hooks delivery, as the plugin params still hold it. */
export function nativeHooksParams(
  delivery: PluginFileDelivery | ProjectMergeDelivery | NoDelivery
): (HooksParamsHead & ProjectHooksDelivery & { hooksRelativePath?: string }) | HooksSupport {
  if (delivery.kind === "none") return refusal(delivery);
  return {
    acceptsHooks: true,
    ...(delivery.hookScript === undefined ? {} : { hookScript: delivery.hookScript }),
    ...(delivery.trustNotice === undefined ? {} : { hooksTrustNotice: delivery.trustNotice }),
    ...(delivery.kind === "project-merge" ? projectParams(delivery) : {}),
  };
}

/** A flat tool's hooks delivery, as the plugin params still hold it. */
export function flatHooksParams(
  delivery: BridgeDelivery | (ProjectMergeDelivery & { flat: HooksFlatPart }) | NoDelivery
): FlatHooksSupport {
  if (delivery.kind === "none") return refusal(delivery);
  const { flat } = delivery;
  return {
    acceptsHooks: true,
    flatHooksDir: flat.dir,
    ...(delivery.hookScript === undefined ? {} : { hookScript: delivery.hookScript }),
    ...(flat.loaderEntry === undefined ? {} : { flatHooksLoaderEntry: flat.loaderEntry }),
    ...(flat.bridge === undefined ? {} : { flatHooksBridge: flat.bridge }),
    ...(delivery.kind === "project-merge" ? projectParams(delivery) : {}),
  };
}

function projectParams(delivery: ProjectMergeDelivery): ProjectHooksDelivery & {
  hooksRelativePath?: string;
} {
  return {
    ...(delivery.pluginFile === undefined ? {} : { hooksRelativePath: delivery.pluginFile }),
    hooksDestination: "project",
    projectHooksRelativePath: delivery.project.relativePath,
    projectHooksFormat: delivery.project.format,
  };
}
