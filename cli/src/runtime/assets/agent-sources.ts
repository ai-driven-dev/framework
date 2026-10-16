import executor from "../../../assets/agents/executor.md";
import explorer from "../../../assets/agents/explorer.md";
import reviewer from "../../../assets/agents/reviewer.md";
import validator from "../../../assets/agents/validator.md";

export const AGENT_SOURCES: Readonly<Record<string, string>> = {
  "aidd-dev-explorer": explorer,
  "aidd-dev-executor": executor,
  "aidd-dev-validator": validator,
  "aidd-dev-reviewer": reviewer,
};
