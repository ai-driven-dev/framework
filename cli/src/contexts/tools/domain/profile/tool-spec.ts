import type { ShippedConfig } from "../../contract/tool-profile.js";
import type { AiTool, IdeToolConfig, ProfileSections } from "../profile.js";
import type { AgentsSection } from "../sections/agents-section.js";
import type { CommandsSection } from "../sections/commands-section.js";
import type { RulesSection } from "../sections/rules-section.js";
import type { SkillsSection } from "../sections/skills-section.js";

export type Unbound<P> = Omit<P, "directory" | "toolSuffix">;
type ParamsOf<T extends new (params: never) => unknown> = ConstructorParameters<T>[0];

/** The directory and suffix a profile states once. Its section builders carry both, so a
 * profile never repeats them. */
export interface BoundTool {
  /** Where a built file lands: `<directory><subdirectory><name without the tool suffix>`. */
  installUnder(subdirectory: string): (fileName: string) => string;
  agents(params: Unbound<ParamsOf<typeof AgentsSection>>): AgentsSection;
  skills(params: Unbound<ParamsOf<typeof SkillsSection>>): SkillsSection;
  commands(params: Unbound<ParamsOf<typeof CommandsSection>>): CommandsSection;
  rules(params: Unbound<ParamsOf<typeof RulesSection>>): RulesSection;
}

type AiToolFields = Omit<
  AiTool<ProfileSections>,
  | "kind"
  | "toolId"
  | "section"
  | "buildContract"
  | "configWrites"
  | "plugins"
  | "supportsUserScopeActivation"
  | "nativeActivation"
  | "agentModels"
  | "hostRefInUse"
  | "markdownSection"
  | "declaresSkills"
  | "configFiles"
  | "runtimeFiles"
  | "configAsset"
  | "mcpConfig"
  | "flatPluginMcp"
  | "settingsFiles"
  | "projectHooksDelivery"
  | "frameworkBuildMode"
  | "distributionPaths"
  | "flatInstallPath"
  | "ownsFlatPath"
  | "marketplaceRegistration"
  | "machineLocalFiles"
  | "installedRulesLocation"
  | "pluginEnablementIsMachineGlobal"
  | "signalDirectoryIn"
>;

export interface AiToolSpec<C extends ProfileSections> extends AiToolFields {
  readonly toolId: string;
  /** The config files the tool ships, each with its content imported where it is declared. */
  readonly configAssets?: readonly ShippedConfig[];
  readonly capabilities: (bound: BoundTool) => C;
}

export interface IdeToolSpec<C extends ProfileSections> {
  readonly toolId: string;
  readonly configAssets?: readonly ShippedConfig[];
  readonly directory: string;
  readonly signalDir: string | null;
  readonly recommendedFor?: IdeToolConfig["recommendedFor"];
  readonly capabilities: () => C;
}
