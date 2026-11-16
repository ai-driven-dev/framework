import { type AgentFrontmatter, pickFrontmatterKeys } from "../../formats/agent-format.js";

/** Copilot reads `effort` as `reasoningEffort`, and gives a subagent the repository
 * instructions only when `include-custom-instructions` is set; it defaults to false. */
export const copilotAgentFrontmatter: AgentFrontmatter = (fm) =>
  pickFrontmatterKeys(
    {
      ...fm,
      reasoningEffort: fm.effort,
      "include-custom-instructions": fm["include-custom-instructions"] ?? true,
    },
    ["name", "description", "model", "reasoningEffort", "include-custom-instructions"]
  );
