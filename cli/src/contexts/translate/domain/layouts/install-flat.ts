import { artifactPath } from "../../../../shared/domain/materialization/artifact-path.js";
import type { SupportedArtifact } from "../../../../shared/domain/materialization/build-contract.js";
import { belowSection } from "../../../../shared/domain/materialization/flat-paths.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import {
  hooksSkip,
  type ReadonlySkipList,
} from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import { isProse } from "../plugin-paths.js";
import { installedCommandPlan } from "../rules/command-plan.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { flatHookPlans } from "../rules/hook-plans.js";
import { chainLinks, toolLinks } from "../rules/links.js";
import type { TranslatedAiTool, TranslatedFlatPlugin } from "../translate-profile.js";
import { flatAgentPlan, flatSkillLinks } from "./build-flat.js";
import { namedByFolder } from "./build-shared.js";
import { installedRulePlan } from "./install-flat-rules.js";

type FlatSection = "agents" | "rules" | "skills";

const FLAT_SECTIONS: readonly FlatSection[] = ["agents", "rules", "skills"];

interface FlatTarget {
  readonly tool: TranslatedAiTool;
  readonly plugins: TranslatedFlatPlugin;
}

interface FlatAt {
  readonly tool: TranslatedAiTool;
  readonly pluginName: string;
}

/** A plugin's files delivered into the tool's own folders, namespaced per plugin. */
export function flatInstallPlan(
  dist: PluginDistribution,
  { tool, plugins }: FlatTarget
): { plans: ComponentPlan[]; flatHookPaths: ReadonlySet<string>; skipped: ReadonlySkipList } {
  const pluginName = dist.manifest.name;
  const at = { tool, pluginName };
  const { namespacePrefix } = plugins.flatLayout();
  const commands = tool.markdownSection("commands") === null ? [] : dist.components.commands;
  const hooksArtifact = flatHooksArtifact(tool);
  const { plans: hooks, warnings: bridgeWarnings } = flatHookPlans(dist, {
    place: (relativePath) =>
      hooksArtifact === null ? null : artifactPath(hooksArtifact, pluginName, relativePath),
    script: (relativePath, content) => plugins.hookScript(relativePath, content),
    bridge: hooksArtifact?.hooksBridge ?? null,
    bridgeFirst: false,
    needsManifest: false,
  });
  const plans = [
    ...commands.map((file) => installedCommandPlan(file, at, namespacePrefix)),
    ...sectionPlans(dist, at, plugins),
    ...hooks,
  ];
  return {
    plans,
    flatHookPaths: new Set(hooks.map((plan) => plan.path)),
    skipped: [
      ...hooksSkips(dist, { tool, plugins }),
      ...bridgeWarnings.map((reason) => hooksSkip(pluginName, tool.toolId, reason)),
    ],
  };
}

/** The plugin's agents, rules and skills, each where the tool reads it. */
function sectionPlans(
  dist: PluginDistribution,
  at: FlatAt,
  plugins: TranslatedFlatPlugin
): ComponentPlan[] {
  return FLAT_SECTIONS.flatMap((section) =>
    dist.components[section].flatMap((file) => {
      const plan = sectionPlan(file, section, at);
      if (plan === null || section !== "rules") return plan === null ? [] : [plan];
      return [
        installedRulePlan(plan, file.content, { tool: at.tool, layout: plugins.flatLayout() }),
      ];
    })
  );
}

function flatHooksArtifact(tool: TranslatedAiTool): SupportedArtifact | null {
  const hooks = tool.buildContract("flat")?.artifacts.hooks;
  return hooks?.supported ? hooks : null;
}

function sectionPlan(
  file: PluginComponentFile,
  section: FlatSection,
  at: FlatAt
): ComponentPlan | null {
  const { tool, pluginName } = at;
  const { relativePath: source, content } = file;
  const declared =
    section === "skills" ? tool.declaresSkills() : tool.markdownSection(section) !== null;
  if (!declared && (section !== "agents" || !isProse(source))) return null;
  // Same rule as the native path: prose is rewritten, an artefact is carried. Rewriting every
  // flat file left a script intact only where a tool's own rewrite happened to spare it.
  const links = isProse(source) ? toolLinks(tool) : undefined;
  const agent = section === "agents" ? agentPlan(file, at) : null;
  if (agent !== null) return { ...agent, links: chainLinks(links, agent.links) };
  if (!declared) return null;
  const path = tool.flatInstallPath(section, pluginName, belowSection(section, source));
  return {
    source,
    path,
    content,
    links: chainLinks(links, skillLinksOf(file, { section, path }, at)),
    namedAfterFolder: folderNamed(tool, section, source),
  };
}

/** A skill entry the tool finds by its folder name carries that name, as its flat build writes it. */
function folderNamed(
  tool: TranslatedAiTool,
  section: FlatSection,
  source: string
): true | undefined {
  const skills = section === "skills" ? tool.buildContract("flat")?.artifacts.skills : undefined;
  return namedByFolder(skills, source);
}

/** An agent a target carries as a build artifact, null when it declares none. */
function agentPlan(file: PluginComponentFile, at: FlatAt): ComponentPlan | null {
  const contract = at.tool.buildContract("flat");
  const artifact = contract?.artifacts.agents;
  if (contract === null || !artifact?.supported) return null;
  return flatAgentPlan(file, { plugin: at.pluginName, contract, artifact, unshaped: "carry" });
}

function hooksSkips(dist: PluginDistribution, { tool, plugins }: FlatTarget): ReadonlySkipList {
  if (dist.components.hooks.length === 0) return [];
  const acceptance = plugins.hooksAcceptance();
  return acceptance.accepts ? [] : [hooksSkip(dist.manifest.name, tool.toolId, acceptance.reason)];
}

/** A skill's prose is read as its flat build reads it: links relative to where it lands. */
export function skillLinksOf(
  file: PluginComponentFile,
  placed: { section: string; path: string },
  at: { tool: TranslatedAiTool; pluginName: string }
): ComponentPlan["links"] {
  const flat = at.tool.buildContract("flat");
  if (placed.section !== "skills" || !isProse(file.relativePath) || flat === null) return undefined;
  return flatSkillLinks(flat, at.pluginName, placed.path);
}
