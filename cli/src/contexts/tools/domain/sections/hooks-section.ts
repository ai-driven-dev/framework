import { CapabilityConfigError } from "../../../../kernel/errors.js";
import type { FlatHooksLoaderEntry } from "../../../../kernel/materialization/flat-paths.js";
import type { FlatHooksBridge } from "../../contract/build-contract.js";
import type { HookScript, ProjectHooksFormat } from "../../contract/tool-vocabulary.js";

export type HooksConfigParams = {
  outputPath: string;
  mergeStrategy?: "user-prime" | "none";
  consumes?: readonly string[];
};

/** The hooks file the framework install writes for a tool, outside any plugin. */
export class HooksConfigPart {
  readonly #params: HooksConfigParams;

  constructor(params: HooksConfigParams) {
    this.#params = params;
    if (/^([/\\]|[A-Za-z]:)/.test(params.outputPath)) {
      throw new CapabilityConfigError(`hooks outputPath "${params.outputPath}" must be relative.`);
    }
    if (params.outputPath.split(/[/\\]/).includes("..")) {
      throw new CapabilityConfigError(
        `hooks outputPath "${params.outputPath}" must stay in the project.`
      );
    }
  }

  consumes(configName: string): boolean {
    return this.#params.consumes?.includes(configName) ?? false;
  }

  outputPath(): string {
    return this.#params.outputPath;
  }

  mergeStrategy(): "user-prime" | "none" {
    return this.#params.mergeStrategy ?? "user-prime";
  }

  accepts(relativePath: string): boolean {
    return relativePath === this.#params.outputPath;
  }

  equals(other: HooksConfigPart): boolean {
    return (
      this.#params.outputPath === other.#params.outputPath &&
      this.#params.mergeStrategy === other.#params.mergeStrategy
    );
  }
}

/** A hook lands in the plugin's own dir, or merged into the project hooks file measured to fire. */
export interface ProjectHooksDelivery {
  hooksDestination?: "plugin" | "project";
  projectHooksRelativePath?: string;
  projectHooksFormat?: ProjectHooksFormat;
}

/** Where a hook lands in the project and how, with the script as this tool runs it. */
export interface ProjectHooksPlacement {
  relativePath: string;
  format: ProjectHooksFormat;
  hookScript: HookScript;
}

export const AS_SHIPPED: HookScript = (_pluginPath, content) => content;

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

/** Where a flat tool keeps a plugin's hooks, and the loader module it is read through, if any. */
export interface HooksFlatPart {
  readonly dir: string;
  readonly loaderEntry?: FlatHooksLoaderEntry;
  readonly bridge?: FlatHooksBridge;
}

/** The hook script as this tool runs it, and what a person must still do before it fires. */
interface HooksDeliveryShared {
  readonly hookScript?: HookScript;
  readonly trustNotice?: string;
}

/** A native tool: the hooks stay in the plugin's own directory, where it reads them. */
export interface PluginFileDelivery extends HooksDeliveryShared {
  readonly kind: "plugin-file";
}

/** The hooks merge into one project file, which the tool reads in place of a plugin's own. */
export interface ProjectMergeDelivery extends HooksDeliveryShared {
  readonly kind: "project-merge";
  readonly project: { readonly relativePath: string; readonly format: ProjectHooksFormat };
  /** The hooks file as the plugin tree holds it, relative to the plugin's root. */
  readonly pluginFile?: string;
  readonly flat?: HooksFlatPart;
}

/** A flat tool whose loader reads the hooks through a module generated per plugin. */
export interface BridgeDelivery extends HooksDeliveryShared {
  readonly kind: "bridge";
  readonly flat: HooksFlatPart;
}

/** A tool that runs no hook a plugin ships. */
export interface NoDelivery {
  readonly kind: "none";
  readonly reason: string;
}

export type HooksDelivery = PluginFileDelivery | ProjectMergeDelivery | BridgeDelivery | NoDelivery;

/** How a tool takes hooks: `config` is the file the framework itself writes for it, `delivery`
 * how a plugin's hooks reach it. Only `config` is ever written by the install. */
export interface HooksSection<D extends HooksDelivery = HooksDelivery> {
  readonly config?: HooksConfigPart;
  readonly delivery: D;
}
