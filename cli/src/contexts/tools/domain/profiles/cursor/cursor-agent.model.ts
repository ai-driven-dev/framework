import {
  type AgentFrontmatter,
  modelWithEffort,
  pickFrontmatterKeys,
} from "../../formats/agent-format.js";

/** Cursor has no effort key: it reads `model[effort=<level>]`. */
export const cursorAgentFrontmatter: AgentFrontmatter = (fm) =>
  pickFrontmatterKeys({ ...fm, model: modelWithEffort(fm, "[effort=", "]") }, [
    "name",
    "description",
    "model",
  ]);
