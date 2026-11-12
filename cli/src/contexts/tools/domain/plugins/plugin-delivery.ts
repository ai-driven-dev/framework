import { CapabilityConfigError } from "../../../../kernel/errors.js";
import type { HooksAcceptance, PluginDelivery } from "../../contract/tool-profile.js";
import type {
  GlobalFiles,
  HookScript,
  ProjectHooksDelivery,
  ProjectHooksFormat,
} from "./plugin-params.js";

/** Where a hook lands in the project and how, with the script as this tool runs it. */
export interface ProjectHooksPlacement {
  relativePath: string;
  format: ProjectHooksFormat;
  hookScript: HookScript;
}

export const AS_SHIPPED: HookScript = (_pluginPath, content) => content;

/**
 * What a tool answers about how a plugin is delivered, as every way a tool takes plugins
 * (native, flat, unsupported) answers it; an answer only one way has lives on that variant,
 * reached by narrowing on `kind`. Callers ask and never read a field.
 */
export abstract class PluginDeliveryBase implements PluginDelivery {
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
