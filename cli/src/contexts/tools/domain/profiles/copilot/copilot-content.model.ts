import { escapeRegExp } from "../../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import { GITKEEP_FILE } from "../../../../../shared/domain/redundant-gitkeeps.js";
import { type LinkSyntax, REFERENCE_CHARS } from "../../../contract/link-syntax.js";
import { rulePatterns } from "../../formats/rule-frontmatter.js";

export const DIRECTORY = ".github/";
export const TOOL_SUFFIX = ".copilot.md";

// Canon's framework-doc reference placeholders. Copilot is the only tool that rewrites
// content between the canonical form and its own workspace-relative paths, so these
// tokens live here rather than in a shared location nothing else reads.
const TOOLS_PLACEHOLDER = "{{TOOLS}}/";
const DOCS_PLACEHOLDER = "{{DOCS}}/";
const AT_TOOLS_PLACEHOLDER = "@{{TOOLS}}/";
const AT_DOCS_PLACEHOLDER = "@{{DOCS}}/";

const DOCS_DIR = "aidd_docs" as const;
export const EXT_AGENT = ".agent.md";
export const EXT_PROMPT = ".prompt.md";
export const EXT_INSTRUCTIONS = ".instructions.md";

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

/** The file's own name, numbering and tool suffix stripped as asked, underscores made dashes. */
function leafName(
  last: string,
  options: { toolSuffix?: string; stripNumericPrefix?: boolean }
): string {
  const unnumbered = options.stripNumericPrefix ? last.replace(/^\d+[_-]/, "") : last;
  const { toolSuffix } = options;
  const unsuffixed =
    toolSuffix && unnumbered.endsWith(toolSuffix)
      ? `${unnumbered.slice(0, -toolSuffix.length)}.md`
      : unnumbered;
  return unsuffixed.replaceAll("_", "-");
}

export function flattenFileName(
  fileName: string,
  targetExt: string,
  options: { toolSuffix?: string; stripNumericPrefix?: boolean } = {}
): string {
  const parts = fileName.split("/");
  const withExt = addTargetExtension(leafName(parts[parts.length - 1], options), targetExt);
  if (parts.length === 1) return withExt;
  return `${buildPrefix(parts.slice(0, -1).join("/"))}-${withExt}`;
}

function buildPrefix(subPath: string): string {
  return subPath
    .split("/")
    .map((p) => p.replace(/^(\d+)[_-].*/, "$1"))
    .join("-");
}

function addTargetExtension(baseName: string, targetExt: string): string {
  if (baseName.endsWith(targetExt)) return baseName;
  const withoutMd = baseName.endsWith(".md") ? baseName.slice(0, -3) : baseName;
  return `${withoutMd}${targetExt}`;
}

export const agentsHandler = {
  buildFilePath(fileName: string): string | null {
    const base = basename(fileName);
    if (base === GITKEEP_FILE) return null;
    const name = base.endsWith(".md") ? `${base.slice(0, -3)}${EXT_AGENT}` : base;
    return `${DIRECTORY}agents/${name}`;
  },
};

export const commandsHandler = {
  buildFilePath(fileName: string): string | null {
    const base = basename(fileName);
    if (base === GITKEEP_FILE) return null;
    const flat = flattenFileName(fileName, EXT_PROMPT);
    return `${DIRECTORY}prompts/${flat}`;
  },
};

export const rulesHandler = {
  buildFilePath(fileName: string): string | null {
    const base = basename(fileName);
    if (base === GITKEEP_FILE) return null;
    const flat = flattenFileName(fileName, EXT_INSTRUCTIONS, {
      toolSuffix: TOOL_SUFFIX,
      stripNumericPrefix: true,
    });
    return `${DIRECTORY}instructions/${flat}`;
  },
  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    if (rulePatterns(fm).length > 0) return { applyTo: rulePatterns(fm).join(",") };
    if (fm.alwaysApply === false && fm.description !== undefined) {
      return { description: fm.description };
    }
    return {};
  },
};

export const skillsHandler = {
  buildFilePath(fileName: string): string | null {
    const base = basename(fileName);
    if (base === GITKEEP_FILE) return null;
    return `${DIRECTORY}skills/${fileName}`;
  },
  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return fm;
  },
};

const INSTALLED_SECTIONS = [
  ["agents/", "agents/", agentsHandler],
  ["commands/", "prompts/", commandsHandler],
  ["rules/", "instructions/", rulesHandler],
] as const;

function resolveInstalledPath(path: string): string {
  for (const [prefix, dir, handler] of INSTALLED_SECTIONS) {
    if (!path.startsWith(prefix)) continue;
    const subPath = path.slice(prefix.length);
    if (subPath === "" || subPath.endsWith("/")) return `${DIRECTORY}${dir}${subPath}`;
    return handler.buildFilePath(subPath) ?? `${DIRECTORY}${path}`;
  }
  // Skills keep their structure, so they take this default with every unknown section: a predictable directory-prefixed default rather than a silently dropped
  // reference when a new section is added to the framework.
  return `${DIRECTORY}${path}`;
}

const reference = (placeholder: string): RegExp =>
  new RegExp(`${escapeRegExp(placeholder)}(${REFERENCE_CHARS})`, "g");
const literal = (text: string): RegExp => new RegExp(escapeRegExp(text), "g");

export const COPILOT_LINK_SYNTAX: LinkSyntax = [
  {
    from: reference(AT_TOOLS_PLACEHOLDER),
    to: (_match, path) => {
      const fullPath = resolveInstalledPath(path);
      return `[${fullPath}](../../${fullPath})`;
    },
  },
  {
    from: reference(AT_DOCS_PLACEHOLDER),
    to: (_match, path) => `[${DOCS_DIR}/${path}](../../${DOCS_DIR}/${path})`,
  },
  // {{TOOLS}}/ (without @) replaces directory prefix only: used for path references in frontmatter or prose.
  // @{{TOOLS}}/ (with @) resolves to a full installed path via resolveInstalledPath: used for @-include syntax.
  { from: literal("{{TOOLS}}/agents/"), to: `${DIRECTORY}agents/` },
  {
    from: new RegExp(`${escapeRegExp("{{TOOLS}}/commands/")}(${REFERENCE_CHARS})`, "g"),
    to: (_match, path) => `${DIRECTORY}prompts/${flattenFileName(path, EXT_PROMPT)}`,
  },
  { from: literal("{{TOOLS}}/rules/"), to: `${DIRECTORY}instructions/` },
  { from: literal("{{TOOLS}}/skills/"), to: `${DIRECTORY}skills/` },
  { from: literal(TOOLS_PLACEHOLDER), to: DIRECTORY },
  { from: literal(DOCS_PLACEHOLDER), to: `${DOCS_DIR}/` },
];
