import type { FlatHooksLoaderEntry } from "../../../../kernel/materialization/flat-paths.js";
import {
  AS_SHIPPED,
  type FlatLayout,
  type HooksAcceptance,
  PluginDeliveryBase,
  type ProjectHooksPlacement,
  resolveProjectHooks,
} from "./plugin-delivery.js";
import type { FlatHooksBridge, FlatParams, FlatSkillLayout, HookScript } from "./plugin-params.js";

/** A tool that loads a plugin's skills, agents and hooks from its own workspace directory. */
export class FlatPlugins extends PluginDeliveryBase {
  readonly #acceptance: HooksAcceptance;
  readonly #layout: FlatLayout;
  readonly #delivered: HookScript;
  readonly #projectHooks: ProjectHooksPlacement | null;

  constructor(params: FlatParams) {
    super(params.globalFiles ?? null);
    const skillLayout: FlatSkillLayout = params.flatSkillLayout ?? "nested";
    if (!params.acceptsHooks) {
      this.#acceptance = { accepts: false, reason: params.hooksUnsupportedReason };
      this.#layout = layoutOf(skillLayout, params.flatNamespacePrefix, null, null, null);
      this.#delivered = AS_SHIPPED;
      this.#projectHooks = null;
      return;
    }
    this.#acceptance = { accepts: true };
    this.#delivered = params.hookScript ?? AS_SHIPPED;
    this.#projectHooks = resolveProjectHooks(params, this.#delivered);
    this.#layout = layoutOf(
      skillLayout,
      params.flatNamespacePrefix,
      params.flatHooksDir,
      params.flatHooksLoaderEntry ?? null,
      params.flatHooksBridge ?? null
    );
  }

  get kind(): "flat" {
    return "flat";
  }
  hooksAcceptance(): HooksAcceptance {
    return this.#acceptance;
  }
  flatLayout(): FlatLayout {
    return this.#layout;
  }
  override projectHooksDelivery(): ProjectHooksPlacement | null {
    return this.#projectHooks;
  }
  override hookScript(pluginPath: string, content: string): string {
    return this.#delivered(pluginPath, content);
  }
}

function layoutOf(
  skillLayout: FlatSkillLayout,
  namespacePrefix: string,
  hooksDir: string | null,
  hooksLoaderEntry: FlatHooksLoaderEntry | null,
  hooksBridge: FlatHooksBridge | null
): FlatLayout {
  return { skillLayout, namespacePrefix, hooksDir, hooksLoaderEntry, hooksBridge };
}
