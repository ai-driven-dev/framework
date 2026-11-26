import type { FlatArtifactLayout } from "../../../../shared/domain/materialization/flat-paths.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import { CapabilityConfigError } from "../../contract/errors/tools.error.js";
import { type HomeTemplate, resolveHomeTemplate } from "../../contract/home-path.js";
import type { GlobalFiles } from "../../contract/tool-vocabulary.js";

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
    return ownsPath(relative, plugin) ? relative : null;
  };
}

/** Whether a path below the directory is one of the plugin's skills or agents. */
function ownsPath(relative: string, plugin: Parameters<GlobalFiles["map"]>[1]): boolean {
  if (relative.startsWith(`skills/${plugin.name}/`)) return true;
  const agent = /^agents\/(.+)\.md$/.exec(relative)?.[1];
  if (agent === undefined || !agent.startsWith(`${plugin.name}-`)) return false;
  return plugin.agents.has(agent.slice(plugin.name.length + 1));
}

/** A tool that installs a plugin into its own plugin directory and activates it natively. */
export interface NativeLayout {
  readonly mode: "native";
  readonly pluginsDir: string;
  readonly installScope: Scope;
  readonly userPluginsDir?: HomeTemplate;
  readonly globalFiles?: GlobalFiles;
  /** Whether an install writes the plugin's tree into `pluginsDir` itself, at any scope, rather
   * than leaving the tool to register a marketplace. */
  readonly materializes: boolean;
}

/** A tool that loads a plugin's files from its own workspace directory. */
export interface FlatPlacement {
  readonly mode: "flat";
  /** Where the plugin's skills and agents land, for an install and a build alike. */
  readonly artifacts: FlatArtifactLayout;
  readonly namespacePrefix: string;
  readonly globalFiles?: GlobalFiles;
}

/** A tool that takes no plugin. */
export interface UnsupportedLayout {
  readonly mode: "unsupported";
}

/** Where and how a tool takes a plugin, by mode. */
export type LayoutSection = NativeLayout | FlatPlacement | UnsupportedLayout;

/** The global files a profile declares: its user configuration directory as a home template. */
export interface GlobalFilesParams {
  readonly dir: HomeTemplate;
  readonly map: GlobalFiles["map"];
}

function globalFilesOf(params: GlobalFilesParams | undefined): { globalFiles?: GlobalFiles } {
  if (params === undefined) return {};
  const { dir, map } = params;
  return { globalFiles: { dir: (homedir) => resolveHomeTemplate(dir, homedir), map } };
}

export interface NativeLayoutParams {
  pluginsDir: string;
  /** `"user"` installs plugins relative to the home directory and requires `userPluginsDir`. */
  installScope?: Scope;
  userPluginsDir?: HomeTemplate;
  globalFiles?: GlobalFilesParams;
  materializes?: boolean;
}

export function nativeLayout(params: NativeLayoutParams): NativeLayout {
  const installScope = params.installScope ?? "project";
  if (installScope === "user" && params.userPluginsDir === undefined) {
    throw new CapabilityConfigError("installScope 'user' requires a userPluginsDir home template.");
  }
  return {
    mode: "native",
    pluginsDir: params.pluginsDir,
    installScope,
    materializes: params.materializes ?? false,
    ...(params.userPluginsDir === undefined ? {} : { userPluginsDir: params.userPluginsDir }),
    ...globalFilesOf(params.globalFiles),
  };
}

export interface FlatPlacementParams {
  namespacePrefix: string;
  artifacts: FlatArtifactLayout;
  globalFiles?: GlobalFilesParams;
}

export function flatPlacement(params: FlatPlacementParams): FlatPlacement {
  return {
    mode: "flat",
    artifacts: params.artifacts,
    namespacePrefix: params.namespacePrefix,
    ...globalFilesOf(params.globalFiles),
  };
}
