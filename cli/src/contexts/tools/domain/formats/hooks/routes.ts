/** What the builders read of a descriptor to deliver a tool's hooks: where each route writes them. */

import type {
  ArtifactContract,
  ConvertHooks,
} from "../../../../../shared/domain/materialization/build-contract.js";
import { CapabilityConfigError } from "../../../contract/errors/tools.error.js";
import type { HookScript } from "../../../contract/tool-vocabulary.js";
import type { HooksFileFormat } from "../../hooks/hooks-entry-shape.js";
import {
  type HooksMergeTarget,
  isHooksFileEmpty,
  mergeHooks,
  pluginEntries,
  pluginScriptDir,
  pluginScriptPath,
  unmergeHooks,
} from "../../hooks/hooks-merge.js";
import {
  type HooksConfigParams,
  HooksConfigPart,
  type PluginFileDelivery,
  type ProjectMergeDelivery,
} from "../../sections/hooks-section.js";
import { type HooksRouting, PLUGIN_HOOKS_SOURCE, type ProjectHooksRoute } from "./descriptor.js";

/** Where a plugin keeps the adapter between its hooks and the host: Claude Code's, as shipped,
 * which a build for another tool replaces with that tool's. */
const HOST_ADAPTER_PATH = "hooks/lib/host.cjs";

export function hookScript(descriptor: HooksRouting): HookScript | undefined {
  const adapter = descriptor.runtime?.adapter;
  if (adapter === undefined) return undefined;
  return (pluginPath, content) => (pluginPath === HOST_ADAPTER_PATH ? adapter : content);
}

export function withHookScript(descriptor: HooksRouting): { readonly hookScript?: HookScript } {
  const swap = hookScript(descriptor);
  return swap === undefined ? {} : { hookScript: swap };
}

/** A native plugin tree keeps the hooks where, and as, the plugin authored them, the tool's
 * adapter aside: at the file the tool reads them from, in the form `convertHooks` gives them. */
export function pluginTreeHooksArtifact(
  descriptor: HooksRouting,
  convertHooks?: ConvertHooks
): ArtifactContract {
  return {
    supported: true,
    source: PLUGIN_HOOKS_SOURCE,
    placement:
      descriptor.pluginFile === undefined
        ? { kind: "relative" }
        : { kind: "file", at: descriptor.pluginFile },
    script: hookScript(descriptor),
    ...(convertHooks === undefined
      ? {}
      : { convertHooks, transform: (json, plugin) => convertHooks(json, plugin).content }),
  };
}

/** The hooks of a tool that reads a plugin's own hooks file where the plugin keeps it. */
export function pluginFileHooksDelivery(descriptor: HooksRouting): PluginFileDelivery {
  const { trustNotice, pluginFile } = descriptor;
  return {
    kind: "plugin-file",
    ...withHookScript(descriptor),
    ...(trustNotice === undefined ? {} : { trustNotice }),
    ...(pluginFile === undefined ? {} : { file: pluginFile }),
  };
}

export function mergeTarget(
  descriptor: HooksRouting,
  file: HooksFileFormat,
  route: { readonly scriptsDir: string }
): HooksMergeTarget {
  return {
    file,
    scriptsDir: route.scriptsDir,
    eventMap: descriptor.undeclaredEvents === "skipped" ? descriptor.eventMap : undefined,
    rootToken: descriptor.rootToken,
  };
}

/** The part the framework install reads to write the tool's own hooks file. */
export function hooksConfigPart(descriptor: {
  readonly config: HooksConfigParams;
}): HooksConfigPart {
  return new HooksConfigPart(descriptor.config);
}

/** A native tool's hooks, as far as plugins go: they stay in the plugin's own directory. */
export function nativeHooksSupport(descriptor: HooksRouting): {
  readonly delivery: PluginFileDelivery;
  readonly rootToken: string;
} {
  const { rootToken } = descriptor;
  if (rootToken === undefined) {
    throw new CapabilityConfigError("native mode requires a pluginRootToken.");
  }
  return { delivery: pluginFileHooksDelivery(descriptor), rootToken };
}

/** The hooks of a tool whose `plugin install` merges them into the project's own file. */
export function projectHooksSupport(
  descriptor: HooksRouting & {
    readonly project: ProjectHooksRoute;
    readonly file: HooksFileFormat;
  }
): ProjectMergeDelivery {
  const route = descriptor.project;
  const target = mergeTarget(descriptor, descriptor.file, route);
  const { trustNotice } = descriptor;
  return {
    kind: "project-merge",
    pluginFile: route.pluginFile,
    project: {
      relativePath: route.sharedFile,
      format: {
        merge: (existing, json, plugin) => mergeHooks(existing, { json, plugin }, target),
        unmerge: (existing, plugin) => unmergeHooks(existing, plugin, target),
        contributedEntries: (content, plugin) => pluginEntries(content, plugin, target),
        isEmpty: isHooksFileEmpty,
        scriptPath: (plugin, rel) => pluginScriptPath(route.scriptsDir, plugin, rel),
        scriptDir: (plugin) => pluginScriptDir(route.scriptsDir, plugin),
      },
    },
    ...withHookScript(descriptor),
    ...(trustNotice === undefined ? {} : { trustNotice }),
  };
}
