import { type AgentFrontmatter, pickFrontmatterKeys } from "../../formats/agent-format.js";

/** Kilo names an agent after its file, reads the effort as the model's `variant`, and passes
 * any unknown key to the model provider, so only its own keys are carried. */
export const kiloAgentFrontmatter: AgentFrontmatter = (fm) => ({
  ...pickFrontmatterKeys({ ...fm, variant: fm.effort }, ["description", "model", "variant"]),
  mode: "subagent",
});
