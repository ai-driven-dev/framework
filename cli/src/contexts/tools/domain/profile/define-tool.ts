import type { AiToolId, IdeToolId } from "../../../../shared/domain/tool.js";
import type { FrameworkBuildMode } from "../../contract/tool-profile.js";
import type { AiTool, IdeToolConfig, ProfileSections } from "../profile.js";
import { AgentsSection } from "../sections/agents-section.js";
import { CommandsSection } from "../sections/commands-section.js";
import { RulesSection } from "../sections/rules-section.js";
import { SkillsSection } from "../sections/skills-section.js";
import {
  aiConfigWrites,
  configAnswers,
  configAssetNamed,
  deliveryAnswers,
  marketplaceOf,
  nativeActivationOf,
  pathAnswers,
  pluginsOf,
  sectionReader,
  settingsOf,
  settingsWrites,
  signalDirectoryOf,
} from "./profile-answers.js";
import {
  refuseDirectory,
  refuseDisagreeingPlugin,
  refuseDisagreeingShippedConfig,
  refuseUnknownSections,
  refuseWithoutBuildContract,
} from "./profile-refusals.js";
import type { AiToolSpec, BoundTool, IdeToolSpec } from "./tool-spec.js";
import { ToolSuffix } from "./tool-suffix.js";

/** Only `defineAiTool` and `defineIdeTool` can produce one: an object literal lacks the private
 * field, so a profile cannot skip the factory's refusals. */
export declare class ProfileBrand {
  private readonly profileBrand: true;
}

/** A profile only the factory could have produced. */
export type BuiltToolConfig = (AiTool | IdeToolConfig) & ProfileBrand;

function bind(directory: string, suffix: ToolSuffix): BoundTool {
  const toolSuffix = suffix.value;
  return {
    installUnder: (subdirectory) => (fileName) =>
      `${directory}${subdirectory}${suffix.strip(fileName)}`,
    agents: (params) => new AgentsSection({ directory, toolSuffix, ...params }),
    skills: (params) => new SkillsSection({ directory, toolSuffix, ...params }),
    commands: (params) => new CommandsSection({ toolSuffix, ...params }),
    rules: (params) => new RulesSection({ toolSuffix, ...params }),
  };
}

function contractFor(
  toolId: string,
  contracts: AiToolSpec<ProfileSections>["buildContracts"],
  capabilities: ProfileSections
) {
  return (mode: FrameworkBuildMode, provider?: string) => {
    const contract = contracts[mode]?.() ?? null;
    if (contract === null || provider === undefined) return contract;
    if (capabilities.models === undefined) {
      throw new Error(`No agent provider is supported for "${toolId}".`);
    }
    return capabilities.models.withAgentModels(contract, toolId, provider);
  };
}

/** What the tool answers from its declared sections. */
function capabilityAnswers(spec: AiToolSpec<ProfileSections>, capabilities: ProfileSections) {
  const plugins = pluginsOf(capabilities);
  const models = capabilities.models?.answersFor(spec.toolId) ?? null;
  return {
    distributionPaths: (kind: "manifest" | "marketplace") => spec.distributionProbes?.[kind] ?? [],
    ...pathAnswers(spec.directory, capabilities),
    configWrites: () => aiConfigWrites(capabilities),
    plugins: () => plugins,
    supportsUserScopeActivation: () => plugins?.supportsUserScopeActivation() ?? false,
    markdownSection: (kind: "commands" | "agents" | "rules") => capabilities[kind] ?? null,
    declaresSkills: () => capabilities.skills !== undefined,
    nativeActivation: () => nativeActivationOf(capabilities),
    agentModels: () => models,
    hostRefInUse: (enabled: boolean) =>
      nativeActivationOf(capabilities)?.takesRefForInUse(enabled) ?? true,
    ...configAnswers(spec.configAssets, capabilities),
    marketplaceRegistration: () => marketplaceOf(capabilities) ?? null,
    ...deliveryAnswers(spec.displayName, capabilities),
    signalDirectoryIn: (projectRoot: string) => signalDirectoryOf(spec.signalDir, projectRoot),
  };
}

export function defineAiTool<C extends ProfileSections>(
  spec: AiToolSpec<C>
): AiTool<C> & ProfileBrand {
  const { toolId, capabilities: declare, ...fields } = spec;
  refuseDirectory(toolId, spec.directory);
  const suffix = new ToolSuffix(spec.toolSuffix);
  const contracts = spec.buildContracts;
  refuseWithoutBuildContract(toolId, contracts);
  const capabilities = declare(bind(spec.directory, suffix));
  refuseUnknownSections(toolId, capabilities);
  refuseDisagreeingPlugin(toolId, capabilities);
  refuseDisagreeingShippedConfig(toolId, spec.configAssets, capabilities);
  const profile = {
    ...fields,
    kind: "ai",
    toolId: toolId as AiToolId,
    section: sectionReader(capabilities),
    frameworkBuildMode: (): FrameworkBuildMode =>
      capabilities.layout?.mode === "flat" ? "flat" : "marketplace",
    buildContract: contractFor(toolId, contracts, capabilities),
    ...capabilityAnswers(spec, capabilities),
  };
  return profile as AiTool<C> & ProfileBrand;
}

export function defineIdeTool<C extends ProfileSections>(
  spec: IdeToolSpec<C>
): IdeToolConfig<C> & ProfileBrand {
  const { toolId, capabilities: declare, ...fields } = spec;
  refuseDirectory(toolId, spec.directory);
  const capabilities = declare();
  refuseUnknownSections(toolId, capabilities);
  refuseDisagreeingShippedConfig(toolId, spec.configAssets, capabilities);
  const profile = {
    ...fields,
    kind: "ide",
    toolId: toolId as IdeToolId,
    section: sectionReader(capabilities),
    configWrites: () => settingsWrites(capabilities),
    settingsFiles: () => settingsOf(capabilities),
    configAsset: (name: string) => configAssetNamed(spec.configAssets, name),
    signalDirectoryIn: (projectRoot: string) => signalDirectoryOf(spec.signalDir, projectRoot),
    machineLocalFiles: (): readonly string[] => [],
  };
  return profile as IdeToolConfig<C> & ProfileBrand;
}
