import { parseFrontmatter } from "../../../shared/domain/markdown.js";
import type { PluginComponentFile } from "../../../shared/domain/plugin/plugin-distribution.js";
import type {
  NativePluginAnswers,
  SkillsSectionAnswers,
} from "../../tools/contract/tool-profile.js";
import { isProse, PLUGIN_HOOKS_DIR, parentDirOf, pathBelowHooks } from "./plugin-paths.js";
import type { TranslatedAiTool } from "./translate-profile.js";

export interface TranslatedFile {
  relativePath: string;
  content: string;
  /** An artefact, not prose: copied byte for byte, with no frontmatter round-trip and no path
   * rewriting. Codex's and Copilot's own rewrites change a bundled script by six and one bytes
   * respectively, which is a file that no longer parses. */
  verbatim?: true;
}

export function translateFile(
  file: PluginComponentFile,
  tool: TranslatedAiTool,
  cap: NativePluginAnswers
): TranslatedFile | null {
  if (file.relativePath === ".mcp.json") {
    const mcp = cap.mcpFile();
    return mcp.accepts ? { relativePath: mcp.relativePath, content: file.content } : null;
  }
  if (file.relativePath.split("/")[0] === PLUGIN_HOOKS_DIR) return translateHooksFile(file, cap);
  return translateComponent(file, tool);
}

function translateHooksFile(
  file: PluginComponentFile,
  cap: NativePluginAnswers
): TranslatedFile | null {
  if (!cap.hooksAcceptance().accepts) return null;
  if (file.relativePath === `${PLUGIN_HOOKS_DIR}/hooks.json`) {
    return { relativePath: cap.hooksFilePath(), content: file.content };
  }
  // Everything under `hooks/` but its own manifest is a script the host runs. It goes beside
  // the manifest, and where the manifest sits at the plugin root it keeps its own directory
  //: a script at the root would leave the command naming `hooks/` pointing at nothing.
  const manifestDir = parentDirOf(cap.hooksFilePath()) || PLUGIN_HOOKS_DIR;
  return {
    relativePath: `${manifestDir}/${pathBelowHooks(file.relativePath)}`,
    content: cap.hookScript(file.relativePath, file.content),
    verbatim: true,
  };
}

function translateComponent(
  file: PluginComponentFile,
  tool: TranslatedAiTool
): TranslatedFile | null {
  const top = file.relativePath.split("/")[0];
  if (top === "commands" || top === "agents" || top === "rules") {
    return translateMarkdown(file, top, tool);
  }
  if (top === "skills") {
    const cap = tool.skillsSection();
    return cap === null ? null : translateSkill(file, cap);
  }
  return null;
}

function toPluginRelativePath(fullPath: string, toolDirectory: string): string {
  const relative = fullPath.startsWith(toolDirectory)
    ? fullPath.slice(toolDirectory.length)
    : fullPath;
  return relative.replace(/^([^/]+)\/aidd\//, "$1/");
}

function translateMarkdown(
  file: PluginComponentFile,
  section: "commands" | "agents" | "rules",
  tool: TranslatedAiTool
): TranslatedFile | null {
  const cap = tool.markdownSection(section);
  if (cap === null) return null;
  const fileName = file.relativePath.slice(`${section}/`.length);
  const fullPath = cap.buildInstallPath(fileName);
  if (fullPath === null) return null;
  const relativePath = toPluginRelativePath(fullPath, tool.directory);
  const { frontmatter, body } = parseFrontmatter(file.content);
  const newFm = cap.convertFrontmatter(frontmatter, fileName);
  const content = cap.serialize(newFm, body);
  return { relativePath, content };
}

/** A skill is prose with frontmatter; anything else under `skills/` is an asset the skill
 * carries. A frontmatter round-trip and a path rewrite are meaningless for a file that is not
 * prose, and both can damage it. */
function translateSkill(file: PluginComponentFile, cap: SkillsSectionAnswers): TranslatedFile {
  if (!isProse(file.relativePath)) {
    return { relativePath: file.relativePath, content: file.content, verbatim: true };
  }
  const { frontmatter, body } = parseFrontmatter(file.content);
  const newFm = cap.convertFrontmatter(frontmatter);
  const content = cap.serialize(newFm, body);
  return { relativePath: file.relativePath, content };
}
