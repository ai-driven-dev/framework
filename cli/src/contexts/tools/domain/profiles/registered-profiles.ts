import type { BuiltToolConfig } from "../profile/define-tool.js";
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
 * doctor flows walk the tools sorted by id instead, see `ToolCatalog.sortedById`. */
export const REGISTERED_PROFILES: readonly BuiltToolConfig[] = [
  claude,
  cursor,
  copilot,
  codex,
  opencode,
  kilo,
  antigravity,
  vscode,
];

/** The same profiles in the order the tools are named in the messages that list them and in the
 * order a manifest's tools are walked. It is not the help order: opencode and kilo come before
 * codex. `ToolCatalog` refuses a list that is not the registration list's own set. */
export const CANONICAL_PROFILES: readonly BuiltToolConfig[] = [
  claude,
  cursor,
  copilot,
  opencode,
  kilo,
  codex,
  antigravity,
  vscode,
];
