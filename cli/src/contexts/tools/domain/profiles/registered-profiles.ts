import type { AiTool, IdeToolConfig } from "../contracts.js";
import type { ProfileBrand } from "../profile/define-tool.js";
import { antigravity } from "./antigravity/profile.js";
import { claude } from "./claude/profile.js";
import { codex } from "./codex/profile.js";
import { copilot } from "./copilot/profile.js";
import { cursor } from "./cursor/profile.js";
import { kilo } from "./kilo/profile.js";
import { opencode } from "./opencode/profile.js";
import { vscode } from "./vscode/profile.js";

/** The registration list, in the order a help text names the tools: AI tools first, then IDE
 * tools. A new tool adds its line here, before the IDE tools if it is an AI tool. The setup and
 * doctor flows walk the tools sorted by id instead, see `getAllRegisteredTools`. */
export const REGISTERED_PROFILES: readonly ((AiTool | IdeToolConfig) & ProfileBrand)[] = [
  claude,
  cursor,
  copilot,
  codex,
  opencode,
  kilo,
  antigravity,
  vscode,
];
