import {
  type AssembledNativeRegistration,
  withNativeRegistration,
} from "../../contexts/host-registration/domain/native-registration/native-host-profile.js";
import type { ProfileBrand } from "../../contexts/tools/domain/profile/define-tool.js";
import type { AiTool, IdeToolConfig } from "../../contexts/tools/domain/profile.js";
import { antigravity } from "./antigravity.js";
import { claude, claudeNativeRegistration } from "./claude.js";
import { codex, codexNativeRegistration } from "./codex.js";
import { copilot, copilotNativeRegistration } from "./copilot.js";
import { cursor } from "./cursor.js";
import { kilo } from "./kilo.js";
import { kiro } from "./kiro.js";
import { opencode } from "./opencode.js";
import { vscode } from "./vscode.js";

/** A registered AI profile: its content profile assembled with its native-registration section,
 * empty for a tool whose own CLI takes no plugins. */
export type RegisteredAiProfile = AiTool & AssembledNativeRegistration & ProfileBrand;
export type RegisteredProfile = RegisteredAiProfile | (IdeToolConfig & ProfileBrand);

/** The registration list, in the canonical order: the order the messages that list tools name
 * them and a manifest's tools are walked. The help order is derived from it, see
 * `ToolCatalog.inHelpOrder`. A new tool adds its line here. The setup and doctor flows walk the
 * tools sorted by id instead, see `ToolCatalog.sortedIds`. */
export const REGISTERED_PROFILES = [
  withNativeRegistration(claude, claudeNativeRegistration),
  withNativeRegistration(cursor, {}),
  withNativeRegistration(copilot, copilotNativeRegistration),
  withNativeRegistration(opencode, {}),
  withNativeRegistration(kilo, {}),
  withNativeRegistration(codex, codexNativeRegistration),
  withNativeRegistration(antigravity, {}),
  withNativeRegistration(kiro, {}),
  vscode,
] as const;
