import { parseFrontmatter, serializeFrontmatter } from "../../../shared/domain/markdown.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../shared/domain/plugin/plugin-translation-skip.js";
import type { FlatPluginAnswers } from "../../tools/contract/tool-profile.js";
import { collectHooksSkips, flatHooksFiles } from "./flat-hooks.js";
import { flatLinkTarget } from "./flat-layout.js";
import type { OutputFile } from "./output-file.js";
import { basename, isProse, makeFile } from "./plugin-paths.js";
import { agentContent } from "./rules/agent-markdown.js";
import type { TranslatedAiTool } from "./translate-profile.js";

type FlatSection = "agents" | "rules" | "skills";

const FLAT_SECTIONS: readonly FlatSection[] = ["agents", "rules", "skills"];

/** The plugin a flat install delivers, and the tool it is delivered for. */
interface FlatTarget {
  readonly pluginName: string;
  readonly tool: TranslatedAiTool;
}

export function translateFlat(
  dist: PluginDistribution,
  tool: TranslatedAiTool,
  plugins: FlatPluginAnswers
): { files: OutputFile[]; skipped: ReadonlySkipList } {
  const { namespacePrefix } = plugins.flatLayout();
  const target = { pluginName: dist.manifest.name, tool };
  const commands = tool.markdownSection("commands") === null ? [] : dist.components.commands;
  const files = [
    ...commands.map((file) => flatCommandFile(file, target, namespacePrefix)),
    ...FLAT_SECTIONS.flatMap((section) =>
      dist.components[section].flatMap((file) => flatSectionFile(file, section, target) ?? [])
    ),
    ...flatHooksFiles(dist, plugins),
  ];
  return { files, skipped: collectHooksSkips(dist, tool, plugins) };
}

function flatCommandFile(
  file: PluginComponentFile,
  target: FlatTarget,
  prefix: string
): OutputFile {
  const { pluginName, tool } = target;
  const filename = basename(file.relativePath);
  const raw = prefixCommandName(file, prefix, pluginName);
  const content = tool.rewriteContent(raw);
  return makeFile(tool.flatInstallPath("commands", pluginName, filename), content);
}

/** An agent a target carries as a build artifact, null when it declares none. */
function agentArtifactFile(
  file: PluginComponentFile,
  content: string,
  { pluginName, tool }: FlatTarget
): OutputFile | null {
  const contract = tool.buildContract("flat");
  const artifact = contract?.artifacts.agents;
  if (contract === null || !artifact?.supported) return null;
  const path = artifact.path(pluginName, file.relativePath);
  const at = {
    plugin: pluginName,
    outName: file.relativePath.slice("agents/".length),
    from: path,
    resolveTarget: (rel: string) => flatLinkTarget(contract, pluginName, rel),
    unshaped: "carry" as const,
  };
  return makeFile(path, agentContent(content, artifact, at));
}

function flatSectionFile(
  file: PluginComponentFile,
  section: FlatSection,
  target: FlatTarget
): OutputFile | null {
  const { pluginName, tool } = target;
  if (!sectionDeclared(tool, section)) {
    if (section !== "agents" || !isProse(file.relativePath)) return null;
    return agentArtifactFile(file, tool.rewriteContent(file.content), target);
  }
  // Same rule as the native path: prose is rewritten, an artefact is carried. Rewriting every
  // flat file left a script intact only where a tool's own rewrite happened to spare it.
  const content = isProse(file.relativePath) ? tool.rewriteContent(file.content) : file.content;
  const artifact = section === "agents" ? agentArtifactFile(file, content, target) : null;
  const fileName = file.relativePath.slice(`${section}/`.length);
  return artifact ?? makeFile(tool.flatInstallPath(section, pluginName, fileName), content);
}

function sectionDeclared(tool: TranslatedAiTool, section: FlatSection): boolean {
  return section === "skills"
    ? tool.skillsSection() !== null
    : tool.markdownSection(section) !== null;
}

function prefixCommandName(file: PluginComponentFile, prefix: string, pluginName: string): string {
  const { frontmatter, body } = parseFrontmatter(file.content);
  const rawName = typeof frontmatter.name === "string" ? frontmatter.name : "";
  const simpleName = stripCommandPrefix(rawName) || basename(file.relativePath);
  const newFrontmatter = { ...frontmatter, name: `${prefix}${pluginName}:${simpleName}` };
  return serializeFrontmatter(newFrontmatter, body);
}

function stripCommandPrefix(name: string): string {
  const match = /^aidd:\d+:(.+)$/.exec(name);
  if (match) return match[1];
  return name.slice(name.lastIndexOf(":") + 1);
}
