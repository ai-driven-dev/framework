import { parseFrontmatter } from "../../../../shared/domain/markdown.js";
import { type AgentFrontmatter, pickFrontmatterKeys } from "./agent-format.js";
import { stringifyToml } from "./toml.js";

/** Codex requires `name` and `description`, and reads the effort as `model_reasoning_effort`. */
export const tomlAgentFrontmatter: AgentFrontmatter = (fm) => ({
  name: typeof fm.name === "string" ? fm.name : "",
  description: typeof fm.description === "string" ? fm.description : "",
  ...pickFrontmatterKeys({ ...fm, model_reasoning_effort: fm.effort }, [
    "model",
    "model_reasoning_effort",
  ]),
});

/** Writes a Codex subagent from its native frontmatter; the body is its instructions. */
export function tomlAgentToml(frontmatter: Record<string, unknown>, body: string): string {
  return stringifyToml({ ...frontmatter, developer_instructions: body });
}

/** Built distributions prefix the name with the plugin: Codex loads agents only from one
 * shared `agents/` directory, never from a plugin, so the prefix keeps two plugins apart. */
export function tomlAgentMarkdownToToml(
  content: string,
  pluginName: string,
  fileBaseName: string
): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const name = `${pluginName}-${fileBaseName.replace(/\.md$/, "")}`;
  return tomlAgentToml(tomlAgentFrontmatter({ ...frontmatter, name }), body);
}
