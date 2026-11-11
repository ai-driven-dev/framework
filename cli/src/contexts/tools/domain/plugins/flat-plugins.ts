import type { FlatHooksLoaderEntry } from "../../../../kernel/materialization/flat-paths.js";
import type {
  FlatHooksBridge,
  FlatParams,
  FlatSkillLayout,
  HookScript,
} from "../capabilities/plugins-capability.js";
import {
  AS_SHIPPED,
  type FlatLayout,
  PluginDeliveryBase,
  type ProjectHooksPlacement,
  resolveProjectHooks,
} from "./plugin-delivery.js";

/** A tool that loads a plugin's skills, agents and hooks from its own workspace directory. */
export class FlatPlugins extends PluginDeliveryBase {
  readonly #acceptance: { accepts: boolean; unsupportedReason: string | null };
  readonly #layout: FlatLayout;
  readonly #delivered: HookScript;
  readonly #projectHooks: ProjectHooksPlacement | null;

  constructor(params: FlatParams) {
    super(params.globalFiles ?? null);
    const skillLayout: FlatSkillLayout = params.flatSkillLayout ?? "nested";
    if (!params.acceptsHooks) {
      this.#acceptance = { accepts: false, unsupportedReason: params.hooksUnsupportedReason };
      this.#layout = layoutOf(skillLayout, params.flatNamespacePrefix, null, null, null);
      this.#delivered = AS_SHIPPED;
      this.#projectHooks = null;
      return;
    }
    this.#acceptance = { accepts: true, unsupportedReason: null };
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

  override buildMode(): "flat" {
    return "flat";
  }
  hooksAcceptance(): { accepts: boolean; unsupportedReason: string | null } {
    return this.#acceptance;
  }
  override flatLayout(): FlatLayout {
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
