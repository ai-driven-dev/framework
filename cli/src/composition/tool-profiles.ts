import { antigravity } from "../contexts/tools/domain/profiles/antigravity/antigravity.profile.js";
import { claude } from "../contexts/tools/domain/profiles/claude/claude.profile.js";
import { codexProfile } from "../contexts/tools/domain/profiles/codex/codex.profile.js";
import { copilot } from "../contexts/tools/domain/profiles/copilot/copilot.profile.js";
import { cursor } from "../contexts/tools/domain/profiles/cursor/cursor.profile.js";
import { kilo } from "../contexts/tools/domain/profiles/kilo/kilo.profile.js";
import { opencode } from "../contexts/tools/domain/profiles/opencode/opencode.profile.js";
import { vscode } from "../contexts/tools/domain/profiles/vscode/vscode.profile.js";
import { SmolTomlCodec } from "../contexts/tools/infrastructure/smol-toml-codec.adapter.js";

const codex = codexProfile(new SmolTomlCodec());

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
