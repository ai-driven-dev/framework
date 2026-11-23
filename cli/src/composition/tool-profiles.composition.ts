import { defineAiTool } from "../contexts/tools/domain/profile/define-tool.js";
import { SmolTomlCodec } from "../contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { antigravity } from "./tool-profiles/antigravity.js";
import { claude } from "./tool-profiles/claude.js";
import { codexSpec } from "./tool-profiles/codex.js";
import { copilot } from "./tool-profiles/copilot.js";
import { cursor } from "./tool-profiles/cursor.js";
import { kilo } from "./tool-profiles/kilo.js";
import { opencode } from "./tool-profiles/opencode.js";
import { vscode } from "./tool-profiles/vscode.js";

/** Codex names the TOML format; its codec is the one adapter wired here. */
const codex = defineAiTool(codexSpec, { toml: new SmolTomlCodec() });

/** The registration list, in the canonical order: the order the messages that list tools name
 * them and a manifest's tools are walked. The help order is derived from it, see
 * `ToolCatalog.inHelpOrder`. A new tool adds its line here. The setup and doctor flows walk the
 * tools sorted by id instead, see `ToolCatalog.sortedIds`. */
export const REGISTERED_PROFILES = [
  claude,
  cursor,
  copilot,
  opencode,
  kilo,
  codex,
  antigravity,
  vscode,
] as const;
