import {
  type AgentFrontmatter,
  modelWithEffort,
  pickFrontmatterKeys,
} from "../../formats/agent-format.js";

/** OpenCode names an agent after its file, so no `name`; `mode: subagent` keeps it out of
 * the primary agents. V2 reads the effort as the model's `#variant`. */
export const opencodeAgentFrontmatter: AgentFrontmatter = (fm) => ({
  ...pickFrontmatterKeys({ ...fm, model: modelWithEffort(fm, "#") }, ["description", "model"]),
  mode: "subagent",
});
