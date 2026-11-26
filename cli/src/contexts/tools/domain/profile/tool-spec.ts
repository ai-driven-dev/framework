import type { ShippedConfig } from "../../contract/tool-profile.js";
import type { AiTool, IdeToolConfig, ProfileSections } from "../profile.js";
import type { DeclaredContract } from "./contract-builders.js";
import type { DeclaredSections } from "./declared-sections.js";

type AiToolFields = Omit<
  AiTool<ProfileSections>,
  | "kind"
  | "toolId"
  | "section"
  | "buildContract"
  | "buildContracts"
  | "configWrites"
  | "plugins"
  | "supportsUserScopeActivation"
  | "agentModels"
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
  | "flatRulesPlacement"
  | "machineLocalFiles"
  | "rulesIndex"
  | "installedRulesLocation"
  | "signalDirectoryIn"
>;

export interface AiToolSpec<S extends DeclaredSections> extends AiToolFields {
  readonly toolId: string;
  /** The config files the tool ships, each with its content imported where it is declared. */
  readonly configAssets?: readonly ShippedConfig[];
  /** One contract per supported build mode, named by kind and built by the factory. */
  readonly buildContracts: {
    readonly marketplace?: DeclaredContract;
    readonly flat?: DeclaredContract;
  };
  readonly capabilities: S;
}

export interface IdeToolSpec<C extends ProfileSections> {
  readonly toolId: string;
  readonly configAssets?: readonly ShippedConfig[];
  readonly directory: string;
  readonly signalDir: string | null;
  readonly recommendedFor?: IdeToolConfig["recommendedFor"];
  readonly capabilities: C;
}
