import {
  artifactPath,
  hooksFilePath,
} from "../../../../shared/domain/materialization/artifact-path.js";
import type {
  SupportedArtifact,
  ToolBuildContract,
} from "../../../../shared/domain/materialization/build-contract.js";
import { shipsHostAdapter } from "../../../../shared/domain/plugin/canon-paths.js";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { PLUGIN_HOOKS_RELATIVE } from "../canon-format.js";
import { mergeFlatHooks } from "../flat-layout.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { flatHookPlans } from "../rules/hook-plans.js";

/** A flat build's hook scripts, and its bridge's warnings in the tool's words. */
export function flatHooks(canon: PluginDistribution, artifact: SupportedArtifact) {
  const bridge = artifact.skipHooksJson ? (artifact.hooksBridge ?? null) : null;
  const { plans, warnings } = flatHookPlans(canon, {
    place: (relativePath) => artifactPath(artifact, canon.manifest.name, relativePath),
    script: (relativePath, content) => artifact.script?.(relativePath, content) ?? content,
    bridge,
    bridgeFirst: true,
    needsManifest: true,
  });
  return { plans, warnings: bridge === null ? [] : warnings.map(bridge.warning) };
}

/** The hooks file a plugin owns whole, for a tool that gives each plugin one: its manifest, merged
 * into nothing. A tool whose hooks file every plugin shares has none, and the sink folds it. */
export function flatOwnHooksFile(
  canon: PluginDistribution,
  contract: ToolBuildContract
): { plan: ComponentPlan; warnings: readonly string[] } | null {
  const { hooks } = contract.artifacts;
  const file = hooks.supported && !hooks.skipHooksJson ? hooks.hooksFile : undefined;
  const manifest = canon.components.hooks.find((f) => f.relativePath === PLUGIN_HOOKS_RELATIVE);
  if (file === undefined || "shared" in file.at || manifest === undefined) return null;
  const plugin = canon.manifest.name;
  const { content, warnings } = mergeFlatHooks({ file, contract }, null, {
    json: manifest.content,
    plugin,
    hostAdapter: shipsHostAdapter(canon.components.hooks),
  });
  return { plan: { source: "", path: hooksFilePath(file, plugin), content }, warnings };
}
