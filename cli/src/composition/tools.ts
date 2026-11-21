import { RegisteredToolCatalog } from "../contexts/tools/application/registered-tool-catalog.js";
import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import type { BuiltToolConfig } from "../contexts/tools/domain/profile/define-tool.js";
import { antigravity } from "../contexts/tools/domain/profiles/antigravity/profile.js";
import { claude } from "../contexts/tools/domain/profiles/claude/profile.js";
import { codexProfile } from "../contexts/tools/domain/profiles/codex/profile.js";
import { copilot } from "../contexts/tools/domain/profiles/copilot/profile.js";
import { cursor } from "../contexts/tools/domain/profiles/cursor/profile.js";
import { kilo } from "../contexts/tools/domain/profiles/kilo/profile.js";
import { opencode } from "../contexts/tools/domain/profiles/opencode/profile.js";
import { vscode } from "../contexts/tools/domain/profiles/vscode/profile.js";
import { SmolTomlCodec } from "../contexts/tools/infrastructure/smol-toml-codec.adapter.js";

const codex = codexProfile(new SmolTomlCodec());

/** The registration list, in the order a help text names the tools: AI tools first, then IDE
 * tools. A new tool adds its line here, before the IDE tools if it is an AI tool. The setup and
 * doctor flows walk the tools sorted by id instead, see `ToolCatalog.sortedIds`. */
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

/** The catalog of every registered tool. Pure and root-independent: the composition root builds
 * it once, and each edge that resolves tools holds it. */
export function wireTools(): ToolCatalog {
  return new RegisteredToolCatalog(REGISTERED_PROFILES, CANONICAL_PROFILES);
}
