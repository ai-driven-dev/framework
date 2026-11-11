import type { AgentsCapability } from "../capabilities/agents-capability.js";
import type { CommandsCapability } from "../capabilities/commands-capability.js";
import type { HooksCapability } from "../capabilities/hooks-capability.js";
import type { McpCapability } from "../capabilities/mcp-capability.js";
import type { PluginsCapability } from "../capabilities/plugins-capability.js";
import type { RulesCapability } from "../capabilities/rules-capability.js";
import type { SettingsCapability } from "../capabilities/settings-capability.js";
import type { SkillsCapability } from "../capabilities/skills-capability.js";

/** What a tool can declare, by the key it declares it under. */
export interface ProfileSections {
  agents?: AgentsCapability;
  skills?: SkillsCapability;
  commands?: CommandsCapability;
  rules?: RulesCapability;
  mcp?: McpCapability;
  hooks?: HooksCapability;
  plugins?: PluginsCapability;
  settings?: SettingsCapability | SettingsCapability[];
}

export type ProfileSectionKey = keyof ProfileSections;

/** What a declared section is: the type under `key`, without the `undefined` of an absent one. */
export type ProfileSection<K extends ProfileSectionKey> = NonNullable<ProfileSections[K]>;

const SECTION_KEYS: readonly string[] = [
  "agents",
  "skills",
  "commands",
  "rules",
  "mcp",
  "hooks",
  "plugins",
  "settings",
] satisfies ProfileSectionKey[];

export function isProfileSectionKey(name: string): name is ProfileSectionKey {
  return SECTION_KEYS.includes(name);
}
