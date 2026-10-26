import { parseFrontmatter } from "../../../../../kernel/markdown.js";
import { stringifyToml } from "./toml.js";

const CLAUDE_MODEL_SELECTOR =
  /^(?:default|inherit|best|fable|haiku|opus|opusplan|sonnet)(?:\[1m\])?$/i;

/**
 * Converts a Claude-format agent markdown file (frontmatter + body) into a Codex subagent TOML
 * string. Key insertion order is fixed for deterministic output, and the conversion is lossy —
 * the TOML schema diverges from the frontmatter, so there is no
 * inverse.
 *
 * Built distributions always prefix the name with the plugin: Codex loads agents only from one
 * shared `agents/` directory, never from a plugin, so the prefix keeps two plugins apart.
 */
export function codexAgentMarkdownToToml(
  content: string,
  pluginName: string,
  fileBaseName: string
): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const name = `${pluginName}-${fileBaseName.replace(/\.md$/, "")}`;
  return codexAgentToml({ ...frontmatter, name }, body);
}

/** The one Codex agent writer, shared by the built distributions and the plugin installer. */
export function codexAgentToml(frontmatter: Record<string, unknown>, body: string): string {
  const obj: Record<string, unknown> = {};
  obj.name = typeof frontmatter.name === "string" ? frontmatter.name : "";
  // description is a required subagent key; default to "" when absent.
  obj.description = typeof frontmatter.description === "string" ? frontmatter.description : "";
  // Claude shorthand selectors are not native model IDs; leave the model inherited.
  if (typeof frontmatter.model === "string" && !CLAUDE_MODEL_SELECTOR.test(frontmatter.model)) {
    obj.model = frontmatter.model;
  }
  if (frontmatter.effort !== undefined) obj.model_reasoning_effort = frontmatter.effort;
  obj.developer_instructions = body;
  return stringifyToml(obj);
}
