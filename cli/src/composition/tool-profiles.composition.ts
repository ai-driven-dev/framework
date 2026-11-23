import type { NativeRegistrationSection } from "../contexts/host-registration/contract/native-registration-spec.js";
import {
  type AssembledNativeRegistration,
  withNativeRegistration,
} from "../contexts/host-registration/domain/native-registration/native-host-profile.js";
import { defineAiTool, type ProfileBrand } from "../contexts/tools/domain/profile/define-tool.js";
import type { AiTool, IdeToolConfig } from "../contexts/tools/domain/profile.js";
import { SmolTomlCodec } from "../contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { antigravity } from "./tool-profiles/antigravity.js";
import { claude, claudeNativeRegistration } from "./tool-profiles/claude.js";
import { codexNativeRegistration, codexSpec } from "./tool-profiles/codex.js";
import { copilot, copilotNativeRegistration } from "./tool-profiles/copilot.js";
import { cursor } from "./tool-profiles/cursor.js";
import { kilo } from "./tool-profiles/kilo.js";
import { opencode } from "./tool-profiles/opencode.js";
import { vscode } from "./tool-profiles/vscode.js";

/** Codex names the TOML format; its codec is the one adapter wired here. */
const codex = defineAiTool(codexSpec, { toml: new SmolTomlCodec() });

/** A registered AI profile: its content profile assembled with its native-registration section,
 * empty for a tool whose own CLI takes no plugins. */
export type RegisteredAiProfile = AiTool & AssembledNativeRegistration & ProfileBrand;
export type RegisteredProfile = RegisteredAiProfile | (IdeToolConfig & ProfileBrand);

function registered<P extends AiTool & ProfileBrand>(
  profile: P,
  section: NativeRegistrationSection = {}
): P & AssembledNativeRegistration {
  return withNativeRegistration(profile, section);
}

/** The registration list, in the canonical order: the order the messages that list tools name
 * them and a manifest's tools are walked. The help order is derived from it, see
 * `ToolCatalog.inHelpOrder`. A new tool adds its line here. The setup and doctor flows walk the
 * tools sorted by id instead, see `ToolCatalog.sortedIds`. */
export const REGISTERED_PROFILES = [
  registered(claude, claudeNativeRegistration),
  registered(cursor),
  registered(copilot, copilotNativeRegistration),
  registered(opencode),
  registered(kilo),
  registered(codex, codexNativeRegistration),
  registered(antigravity),
  vscode,
] as const;
