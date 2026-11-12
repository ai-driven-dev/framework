import {
  type FlatHooksLoaderEntry,
  flatHooksPathWithLoaderEntry,
} from "../../../../kernel/materialization/flat-paths.js";
import type { FlatHooksBridge } from "../../contract/build-contract.js";
import type { FlatLayout, FlatSkillLayout, HooksAcceptance } from "../../contract/tool-profile.js";
import type { HookScript } from "../../contract/tool-vocabulary.js";
import {
  AS_SHIPPED,
  type ProjectHooksPlacement,
  resolveProjectHooks,
} from "../sections/hooks-section.js";
import { PluginDeliveryBase } from "./plugin-delivery.js";
import type { FlatParams } from "./plugin-params.js";

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
  override materializesFromBuiltTree(): boolean {
    return true;
  }
  hooksAcceptance(): HooksAcceptance {
    return this.#acceptance;
  }
  flatLayout(): FlatLayout {
    return this.#layout;
  }
  hooksInstallPath(pluginName: string, hooksRelativePath: string): string | null {
    const { hooksDir, hooksLoaderEntry } = this.#layout;
    if (hooksDir === null) return null;
    return flatHooksPathWithLoaderEntry(hooksDir, hooksLoaderEntry, pluginName, hooksRelativePath);
  }
  projectHooksDelivery(): ProjectHooksPlacement | null {
    return this.#projectHooks;
  }
  hookScript(pluginPath: string, content: string): string {
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
