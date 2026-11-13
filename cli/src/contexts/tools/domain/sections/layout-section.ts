import { CapabilityConfigError } from "../../../../shared/domain/errors.js";
import type { FlatSkillLayout } from "../../contract/tool-profile.js";
import type { GlobalFiles } from "../../contract/tool-vocabulary.js";
import { MarketplaceRegistration } from "../native-registration/marketplace-registration.js";
import type { MarketplaceSettings } from "../native-registration/marketplace-settings.js";
import {
  NativeActivation,
  type NativeActivationSpec,
} from "../native-registration/native-activation.js";

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

/** A tool that installs a plugin into its own plugin directory and activates it natively. */
export interface NativeLayout {
  readonly mode: "native";
  readonly pluginsDir: string;
  readonly installScope: "project" | "user";
  readonly userPluginsDir?: (homedir: string) => string;
  readonly globalFiles?: GlobalFiles;
  /** The tool's own plugin CLI, when it drives the activation. */
  readonly activation?: NativeActivation;
  /** Where the tool records the marketplaces it knows, which needs an activation. */
  readonly marketplace?: MarketplaceRegistration;
}

/** A tool that loads a plugin's files from its own workspace directory. */
export interface FlatPlacement {
  readonly mode: "flat";
  readonly skillLayout: FlatSkillLayout;
  readonly namespacePrefix: string;
  readonly globalFiles?: GlobalFiles;
}

/** A tool that takes no plugin. */
export interface UnsupportedLayout {
  readonly mode: "unsupported";
}

/** Where and how a tool takes a plugin, by mode. */
export type LayoutSection = NativeLayout | FlatPlacement | UnsupportedLayout;

export interface NativeLayoutParams {
  pluginsDir: string;
  /** `"user"` installs plugins relative to the home directory and requires `userPluginsDir`. */
  installScope?: "project" | "user";
  userPluginsDir?: (homedir: string) => string;
  globalFiles?: GlobalFiles;
  nativeActivation?: NativeActivationSpec;
  marketplaceSettings?: MarketplaceSettings;
}

export function nativeLayout(params: NativeLayoutParams): NativeLayout {
  const installScope = params.installScope ?? "project";
  if (installScope === "user" && params.userPluginsDir === undefined) {
    throw new CapabilityConfigError(
      "installScope 'user' requires a userPluginsDir resolver function."
    );
  }
  const activation =
    params.nativeActivation === undefined
      ? undefined
      : new NativeActivation(params.nativeActivation);
  const marketplace =
    params.marketplaceSettings === undefined
      ? undefined
      : new MarketplaceRegistration(params.marketplaceSettings, activation ?? null);
  return {
    mode: "native",
    pluginsDir: params.pluginsDir,
    installScope,
    ...(params.userPluginsDir === undefined ? {} : { userPluginsDir: params.userPluginsDir }),
    ...(params.globalFiles === undefined ? {} : { globalFiles: params.globalFiles }),
    ...(activation === undefined ? {} : { activation }),
    ...(marketplace === undefined ? {} : { marketplace }),
  };
}

export interface FlatPlacementParams {
  namespacePrefix: string;
  skillLayout?: FlatSkillLayout;
  globalFiles?: GlobalFiles;
}

export function flatPlacement(params: FlatPlacementParams): FlatPlacement {
  return {
    mode: "flat",
    skillLayout: params.skillLayout ?? "nested",
    namespacePrefix: params.namespacePrefix,
    ...(params.globalFiles === undefined ? {} : { globalFiles: params.globalFiles }),
  };
}
