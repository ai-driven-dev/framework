import { reshapeFrontmatter, serializeFrontmatter } from "../../../../shared/domain/markdown.js";
import type { ReadonlyNoticeList } from "../../../../shared/domain/materialization/plugin-install-notice.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import { isComponentFile, isProse, PLUGIN_HOOKS_DIR } from "../plugin-paths.js";
import { namedByPlugin } from "../rules/agent-markdown.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { toolLinks } from "../rules/links.js";
import type { TranslatedAiTool, TranslatedNativePlugin } from "../translate-profile.js";
import { isEntry } from "./build-shared.js";
import { hooksTrustNotices, manifestPlan, nativeHooksPlan } from "./install-native-hooks.js";

interface NativeTarget {
  readonly tool: TranslatedAiTool;
  readonly plugins: TranslatedNativePlugin;
}

/** A plugin installed as a directory of its own: every file under the tool's plugin root. */
export function nativeInstallPlan(
  dist: PluginDistribution,
  target: NativeTarget & { readonly manifestPaths: readonly string[] }
): {
  plans: ComponentPlan[];
  componentPaths: ReadonlyMap<string, string>;
  notices: ReadonlyNoticeList;
} {
  const { tool, plugins, manifestPaths } = target;
  const pluginRoot = plugins.pluginOutputDir(dist.manifest.name);
  const at = { tool, plugins, pluginRoot, pluginName: dist.manifest.name };
  const plans = dist.files.flatMap((file) => nativeFilePlan(file, at) ?? []);
  const manifest = manifestPlan(dist, { plugins, pluginRoot, manifestPaths });
  if (manifest !== null) plans.push(manifest);
  const componentPaths = new Map(
    plans.filter((plan) => isComponentFile(plan.source)).map((plan) => [plan.path, plan.source])
  );
  return { plans, componentPaths, notices: hooksTrustNotices(dist, { tool, plugins }) };
}

interface NativeAt extends NativeTarget {
  readonly pluginRoot: string;
  readonly pluginName: string;
}

function nativeFilePlan(file: PluginComponentFile, at: NativeAt): ComponentPlan | null {
  const { source, top } = { source: file.relativePath, top: file.relativePath.split("/")[0] };
  if (source === ".mcp.json") return mcpPlan(file, at);
  if (top === PLUGIN_HOOKS_DIR) return nativeHooksPlan(file, at);
  if (top === "commands" || top === "agents" || top === "rules") return markdownPlan(file, top, at);
  return top === "skills" ? skillPlan(file, at) : null;
}

// Prose is rewritten, an artefact is carried byte for byte: a tool's own rewrite leaving a script
// intact is luck rather than a guarantee.
function linksOf(source: string, tool: TranslatedAiTool): ComponentPlan["links"] {
  return isProse(source) ? toolLinks(tool) : undefined;
}

// The plugin-root variable is a path, not prose: a hook manifest and an mcp manifest both name
// one, in JSON. Gating it on prose left every tool but Claude installing a hook that points at a
// variable its own runtime never expands.
function mcpPlan(
  file: PluginComponentFile,
  { plugins, pluginRoot }: NativeAt
): ComponentPlan | null {
  const mcp = plugins.mcpFile();
  if (!mcp.accepts) return null;
  const { relativePath: source, content } = file;
  return {
    source,
    path: `${pluginRoot}${mcp.relativePath}`,
    content,
    rootToken: plugins.rootToken(),
  };
}

function markdownPlan(
  file: PluginComponentFile,
  kind: "commands" | "agents" | "rules",
  at: NativeAt
): ComponentPlan | null {
  const { relativePath: source, content } = file;
  const { tool, plugins, pluginRoot } = at;
  const section = tool.markdownSection(kind);
  const fileName = source.slice(`${kind}/`.length);
  const fullPath = section?.buildInstallPath(fileName);
  if (!section || fullPath === null || fullPath === undefined) return null;
  return {
    source,
    path: `${pluginRoot}${toPluginRelativePath(fullPath, tool.directory)}`,
    content,
    links: linksOf(source, tool),
    shape: (text) =>
      reshapeFrontmatter(text, {
        frontmatter: (fm) =>
          section.convertFrontmatter(pluginNamed(fm, { kind, fileName }, at), fileName),
        serialize: (fm, body) =>
          section.serialize ? section.serialize(fm, body) : serializeFrontmatter(fm, body),
      }),
    rootToken: plugins.rootToken(),
  };
}

/** An agent its tool's marketplace build names after its plugin carries that name here too. */
function pluginNamed(
  frontmatter: Record<string, unknown>,
  agent: { kind: string; fileName: string },
  at: NativeAt
): Record<string, unknown> {
  const agents = at.tool.buildContract("marketplace")?.artifacts.agents;
  if (agent.kind !== "agents" || !agents?.supported) return frontmatter;
  return namedByPlugin(frontmatter, agents.agentMarkdown, {
    plugin: at.pluginName,
    outName: agent.fileName,
  });
}

// Only a skill's entry carries the frontmatter its tool reads. Anything else under `skills/` is an
// action or an asset the skill carries, and its own frontmatter belongs to what it is.
function skillPlan(file: PluginComponentFile, at: NativeAt): ComponentPlan | null {
  const { relativePath: source, content } = file;
  const { tool, plugins, pluginRoot } = at;
  if (!tool.declaresSkills()) return null;
  const path = `${pluginRoot}${source}`;
  if (!isProse(source)) return { source, path, content };
  return {
    source,
    path,
    content,
    links: linksOf(source, tool),
    shape: isEntry(source)
      ? (text) => reshapeFrontmatter(text, { frontmatter: skillFrontmatterOf(tool) })
      : undefined,
    rootToken: plugins.rootToken(),
  };
}

/** The tool's own shape for a skill's frontmatter, the one its marketplace build applies. */
function skillFrontmatterOf(
  tool: TranslatedAiTool
): (fm: Record<string, unknown>) => Record<string, unknown> {
  const skills = tool.buildContract("marketplace")?.artifacts.skills;
  return (skills?.supported ? skills.skillFrontmatter : undefined) ?? ((fm) => fm);
}

function toPluginRelativePath(fullPath: string, toolDirectory: string): string {
  const relative = fullPath.startsWith(toolDirectory)
    ? fullPath.slice(toolDirectory.length)
    : fullPath;
  return relative.replace(/^([^/]+)\/aidd\//, "$1/");
}
