import { parseFrontmatter } from "./markdown.js";
import { stringifyToml } from "./toml.js";

/**
 * Converts a Claude-format agent markdown file (frontmatter + body) into a
 * Codex subagent TOML string.
 *
 * TOML schema mapping (D-14, D-15, D-16):
 *   name               — fm.name when present (string), else "<pluginName>-<basename>"
 *   description        — fm.description when present (string)
 *   model              — omitted in MVP1 (D-5): no known Codex model id set
 *   developer_instructions — verbatim body, no rewrite (D-4)
 *
 * Key insertion order is fixed for deterministic output (D-15).
 *
 * No inverse: codexAgentMarkdownToToml is lossy — the model field is intentionally
 * omitted (D-5) and the TOML schema diverges from markdown frontmatter, making a
 * lossless round-trip technically impossible.
 */
export function codexAgentMarkdownToToml(
  content: string,
  pluginName: string,
  fileBaseName: string
): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const name = resolveName(frontmatter, pluginName, fileBaseName);
  const obj = buildTomlObject(name, frontmatter, body);
  return stringifyToml(obj);
}

function resolveName(
  frontmatter: Record<string, unknown>,
  pluginName: string,
  fileBaseName: string
): string {
  if (typeof frontmatter.name === "string" && frontmatter.name.length > 0) {
    return frontmatter.name;
  }
  const basename = fileBaseName.replace(/\.md$/, "");
  return `${pluginName}-${basename}`;
}

function buildTomlObject(
  name: string,
  frontmatter: Record<string, unknown>,
  body: string
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  obj.name = name;
  if (typeof frontmatter.description === "string" && frontmatter.description.length > 0) {
    obj.description = frontmatter.description;
  }
  // model is intentionally omitted in MVP1 (D-5): no known Codex model id set.
  obj.developer_instructions = body;
  return obj;
}
