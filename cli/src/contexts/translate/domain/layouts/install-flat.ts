import { reshapeFrontmatter } from "../../../../shared/domain/markdown.js";
import { artifactPath } from "../../../../shared/domain/materialization/artifact-path.js";
import type { SupportedArtifact } from "../../../../shared/domain/materialization/build-contract.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import type {
  PluginTranslationSkip,
  ReadonlySkipList,
} from "../../../../shared/domain/plugin/plugin-translation-skip.js";
import { basename, isProse } from "../plugin-paths.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { flatHookPlans } from "../rules/hook-plans.js";
import { chainLinks, toolLinks } from "../rules/links.js";
import type { TranslatedAiTool, TranslatedFlatPlugin } from "../translate-profile.js";
import { flatAgentPlan } from "./build-flat.js";
import { scopedRulesOf, scopeStated } from "./install-flat-rules.js";

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
  const scoped = scopedRulesOf(dist, plugins);
  const hooks = flatHookPlans(dist, {
    place: (relativePath) =>
      hooksArtifact === null ? null : artifactPath(hooksArtifact, pluginName, relativePath),
    script: (relativePath, content) => plugins.hookScript(relativePath, content),
    bridge: hooksArtifact?.hooksBridge ?? null,
    bridgeFirst: false,
    needsManifest: false,
  });
  const plans = [
    ...commands.map((file) => commandPlan(file, at, namespacePrefix)),
    ...FLAT_SECTIONS.flatMap((section) =>
      dist.components[section].flatMap((file) => {
        const plan = sectionPlan(file, section, at);
        const paths = scoped.get(file);
        return plan === null ? [] : [paths === undefined ? plan : scopeStated(plan, paths)];
      })
    ),
    ...hooks,
  ];
  return {
    plans,
    flatHookPaths: new Set(hooks.map((plan) => plan.path)),
    skipped: hooksSkips(dist, { tool, plugins }),
  };
}

function flatHooksArtifact(tool: TranslatedAiTool): SupportedArtifact | null {
  const hooks = tool.buildContract("flat")?.artifacts.hooks;
  return hooks?.supported ? hooks : null;
}

function commandPlan(file: PluginComponentFile, at: FlatAt, prefix: string): ComponentPlan {
  const { tool, pluginName } = at;
  const { relativePath: source, content } = file;
  return {
    source,
    path: tool.flatInstallPath("commands", pluginName, basename(source)),
    content,
    links: toolLinks(tool),
    shape: (text) => prefixCommandName(text, { source, prefix, pluginName }),
  };
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
  const path = tool.flatInstallPath(section, pluginName, source.slice(`${section}/`.length));
  return { source, path, content, links };
}

/** An agent a target carries as a build artifact, null when it declares none. */
function agentPlan(file: PluginComponentFile, at: FlatAt): ComponentPlan | null {
  const contract = at.tool.buildContract("flat");
  const artifact = contract?.artifacts.agents;
  if (contract === null || !artifact?.supported) return null;
  return flatAgentPlan(file, { plugin: at.pluginName, contract, artifact, unshaped: "carry" });
}

function prefixCommandName(
  content: string,
  at: { source: string; prefix: string; pluginName: string }
): string {
  return reshapeFrontmatter(content, {
    frontmatter: (frontmatter) => {
      const rawName = typeof frontmatter.name === "string" ? frontmatter.name : "";
      const simpleName = stripCommandPrefix(rawName) || basename(at.source);
      return { ...frontmatter, name: `${at.prefix}${at.pluginName}:${simpleName}` };
    },
  });
}

function stripCommandPrefix(name: string): string {
  const match = /^aidd:\d+:(.+)$/.exec(name);
  if (match) return match[1];
  return name.slice(name.lastIndexOf(":") + 1);
}

function hooksSkips(dist: PluginDistribution, { tool, plugins }: FlatTarget): ReadonlySkipList {
  if (dist.components.hooks.length === 0) return [];
  const acceptance = plugins.hooksAcceptance();
  if (acceptance.accepts) return [];
  const entry: PluginTranslationSkip = {
    pluginName: dist.manifest.name,
    component: "hooks",
    toolId: tool.toolId,
    reason: acceptance.reason,
  };
  return [entry];
}
