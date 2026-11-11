import type { AiTool, IdeToolConfig } from "../contracts.js";
import { antigravity } from "./antigravity/profile.js";
import { claude } from "./claude/profile.js";
import { codex } from "./codex/profile.js";
import { copilot } from "./copilot/profile.js";
import { cursor } from "./cursor/profile.js";
import { kilo } from "./kilo/profile.js";
import { opencode } from "./opencode/profile.js";
import { vscodeToolConfig } from "./vscode/profile.js";

/** The order the setup and doctor flows walk the tools; a new tool adds its line here. */
export const REGISTERED_PROFILES: readonly (AiTool<unknown> | IdeToolConfig)[] = [
  antigravity,
  claude,
  codex,
  copilot,
  cursor,
  kilo,
  opencode,
  vscodeToolConfig,
];
