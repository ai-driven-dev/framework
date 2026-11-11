import { CapabilityConfigError } from "../../../../kernel/errors.js";
import type { FlatHooksLoaderEntry } from "../../../../kernel/materialization/flat-paths.js";
import type {
  FlatHooksBridge,
  FlatSkillLayout,
  GlobalFiles,
  HookScript,
  ProjectHooksDelivery,
  ProjectHooksFormat,
} from "./plugin-params.js";

/** Where a flat-mode plugin lands and how its hooks are loaded; each part is `null` or
 * `"nested"` when the mode has none. */
export interface FlatLayout {
  skillLayout: FlatSkillLayout;
  namespacePrefix: string | null;
  hooksDir: string | null;
  hooksLoaderEntry: FlatHooksLoaderEntry | null;
  hooksBridge: FlatHooksBridge | null;
}

/** Where a hook lands in the project and how, with the script as this tool runs it. */
export interface ProjectHooksPlacement {
  relativePath: string;
  format: ProjectHooksFormat;
  hookScript: HookScript;
}

export const AS_SHIPPED: HookScript = (_pluginPath, content) => content;

/** Whether a delivered hook runs on this tool, and why not when it does not. */
export type HooksAcceptance = { accepts: true } | { accepts: false; reason: string };

/**
 * What a tool answers about how a plugin is delivered, as every way a tool takes plugins
 * (native, flat, unsupported) answers it; an answer only one way has lives on that variant,
 * reached by narrowing on `kind`. Callers ask and never read a field.
 */
export abstract class PluginDeliveryBase {
  readonly #machineFiles: GlobalFiles | null;

  constructor(machineFiles: GlobalFiles | null) {
    this.#machineFiles = machineFiles;
  }

  abstract get kind(): "native" | "flat" | "unsupported";
  abstract hooksAcceptance(): HooksAcceptance;

  abstract projectHooksDelivery(): ProjectHooksPlacement | null;

  deliversHooksToProject(): boolean {
    return this.projectHooksDelivery() !== null;
  }
  supportsUserScopeActivation(): boolean {
    return this.#machineFiles !== null;
  }
  copiesFilesGlobally(): boolean {
    return this.#machineFiles !== null;
  }
  globalFiles(): GlobalFiles | null {
    return this.#machineFiles;
  }
  userPluginsBaseDir(homedir: string): string | null {
    return this.#machineFiles?.dir(homedir) ?? null;
  }
}

/**
 * The project hooks file this tool delivers to, or `null` when a hook lands in the plugin's own
 * directory. A project destination without its file path and format is refused here.
 */
export function resolveProjectHooks(
  delivery: ProjectHooksDelivery,
  hookScript: HookScript
): ProjectHooksPlacement | null {
  if (delivery.hooksDestination !== "project") {
    if (delivery.projectHooksFormat !== undefined) {
      throw new CapabilityConfigError("projectHooksFormat requires hooksDestination 'project'.");
    }
    return null;
  }
  if (delivery.projectHooksRelativePath === undefined) {
    throw new CapabilityConfigError(
      "hooksDestination 'project' requires a projectHooksRelativePath."
    );
  }
  if (delivery.projectHooksFormat === undefined) {
    throw new CapabilityConfigError("hooksDestination 'project' requires a projectHooksFormat.");
  }
  return {
    relativePath: delivery.projectHooksRelativePath,
    format: delivery.projectHooksFormat,
    hookScript,
  };
}
