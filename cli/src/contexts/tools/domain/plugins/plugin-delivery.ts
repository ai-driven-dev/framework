import type { HooksAcceptance, PluginDelivery } from "../../contract/tool-profile.js";
import type { GlobalFiles } from "../../contract/tool-vocabulary.js";
import type { ProjectHooksPlacement } from "../sections/hooks-section.js";

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

  requiresUserScope(): boolean {
    return false;
  }
  materializesFromBuiltTree(): boolean {
    return this.requiresUserScope();
  }
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
