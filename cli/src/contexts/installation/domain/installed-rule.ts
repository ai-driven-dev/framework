import { parseFrontmatter } from "../../../shared/domain/markdown.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type { InstalledRule } from "../contract/installed-rule.js";

/** Each tool names the scope field differently: `paths` for Claude Code and Codex, `globs`
 * for Cursor, `applyTo` for Copilot. Read all three and merge, rather than branch on the
 * tool: a file converted from one tool to another carries whichever its source used, and a
 * reader asking one question should not have to know which tool answered. */
const SCOPE_FIELDS = ["paths", "globs", "applyTo"] as const;

function globsIn(value: unknown): readonly string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((glob) => glob.trim())
    .filter((glob) => glob !== "");
}

function scopeOf(frontmatter: Record<string, unknown>): readonly string[] {
  return [...new Set(SCOPE_FIELDS.flatMap((field) => globsIn(frontmatter[field])))];
}

/** The installed extension, whole. Trimming at the last dot would leave `.instructions`
 * glued to every Copilot rule's name, since what it installs is `<name>.instructions.md`. */
function nameOf(path: string, extension: string): string {
  const basename = path.split("/").at(-1) ?? path;
  return basename.endsWith(extension) ? basename.slice(0, -extension.length) : basename;
}

export function toInstalledRule(
  tool: AiToolId,
  path: string,
  extension: string,
  content: string
): InstalledRule {
  const { frontmatter } = parseFrontmatter(content);
  const description = frontmatter.description;
  const paths = scopeOf(frontmatter);
  return {
    tool,
    path,
    name: nameOf(path, extension),
    description: typeof description === "string" ? description : "",
    ...(paths.length === 0 ? {} : { paths }),
  };
}
