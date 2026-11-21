import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlyNoticeList } from "../../../tools/contract/plugin-install-notice.js";
import type { NativePluginAnswers } from "../../../tools/contract/tool-profile.js";
import { isComponentFile, isProse, PLUGIN_HOOKS_DIR } from "../plugin-paths.js";
import type { ComponentPlan } from "../rules/component-pipeline.js";
import { reshapeFrontmatter } from "../rules/frontmatter.js";
import { toolLinks } from "../rules/links.js";
import type { TranslatedAiTool } from "../translate-profile.js";
import { hooksTrustNotices, manifestPlan, nativeHooksPlan } from "./install-native-hooks.js";

interface NativeTarget {
  readonly tool: TranslatedAiTool;
  readonly plugins: NativePluginAnswers;
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
  const at = { tool, plugins, pluginRoot };
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
        frontmatter: (fm) => section.convertFrontmatter(fm, fileName),
        serialize: (fm, body) => section.serialize(fm, body),
      }),
    rootToken: plugins.rootToken(),
  };
}

// A skill is prose with frontmatter; anything else under `skills/` is an asset the skill carries,
// and a frontmatter round-trip is meaningless for it.
function skillPlan(file: PluginComponentFile, at: NativeAt): ComponentPlan | null {
  const { relativePath: source, content } = file;
  const { tool, plugins, pluginRoot } = at;
  const section = tool.skillsSection();
  if (section === null) return null;
  const path = `${pluginRoot}${source}`;
  if (!isProse(source)) return { source, path, content };
  return {
    source,
    path,
    content,
    links: linksOf(source, tool),
    shape: (text) =>
      reshapeFrontmatter(text, {
        frontmatter: (fm) => section.convertFrontmatter(fm),
        serialize: (fm, body) => section.serialize(fm, body),
      }),
    rootToken: plugins.rootToken(),
  };
}

function toPluginRelativePath(fullPath: string, toolDirectory: string): string {
  const relative = fullPath.startsWith(toolDirectory)
    ? fullPath.slice(toolDirectory.length)
    : fullPath;
  return relative.replace(/^([^/]+)\/aidd\//, "$1/");
}
