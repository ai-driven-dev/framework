import type { AiToolId, IdeToolId } from "../../../../shared/domain/tool.js";
import type { FrameworkBuildMode } from "../../contract/tool-profile.js";
import type { AiTool, IdeToolConfig, ProfileSections } from "../profile.js";
import { contractOf, type ToolFormats } from "./contract-builders.js";
import { type BuiltSections, buildSections, type DeclaredSections } from "./declared-sections.js";
import {
  aiConfigWrites,
  configAnswers,
  configAssetNamed,
  deliveryAnswers,
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
import type { AiToolSpec, IdeToolSpec } from "./tool-spec.js";
import { ToolSuffix } from "./tool-suffix.js";

/** Only `defineAiTool` and `defineIdeTool` can produce one: an object literal lacks the private
 * field, so a profile cannot skip the factory's refusals. */
export declare class ProfileBrand {
  private readonly profileBrand: true;
}

/** A profile only the factory could have produced. */
export type BuiltToolConfig = (AiTool | IdeToolConfig) & ProfileBrand;

/** Each declared contract, built on first ask by the builder its kind names. */
function contractsOf(
  declared: AiToolSpec<DeclaredSections>["buildContracts"],
  formats: ToolFormats
): AiTool["buildContracts"] {
  const { marketplace, flat } = declared;
  return {
    ...(marketplace && { marketplace: contractOf(marketplace, formats) }),
    ...(flat && { flat: contractOf(flat, formats) }),
  };
}

function contractFor(
  toolId: string,
  contracts: AiTool["buildContracts"],
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
function capabilityAnswers(spec: AiToolSpec<DeclaredSections>, capabilities: ProfileSections) {
  const plugins = pluginsOf(capabilities);
  const models = capabilities.models?.answersFor(spec.toolId) ?? null;
  return {
    distributionPaths: (kind: "manifest" | "marketplace") => spec.distributionProbes?.[kind] ?? [],
    ...pathAnswers(spec.directory, capabilities),
    configWrites: () => aiConfigWrites(capabilities),
    plugins: () => plugins,
    supportsUserScopeActivation: () => plugins?.copiesFilesGlobally() ?? false,
    markdownSection: (kind: "commands" | "agents" | "rules") => capabilities[kind] ?? null,
    declaresSkills: () => capabilities.skills !== undefined,
    agentModels: () => models,
    ...configAnswers(spec.configAssets, capabilities),
    ...deliveryAnswers(spec.displayName, capabilities),
    signalDirectoryIn: (projectRoot: string) => signalDirectoryOf(spec.signalDir, projectRoot),
  };
}

/** A tool from its declaration; `formats` holds the codecs its declarations name by format. */
export function defineAiTool<S extends DeclaredSections>(
  spec: AiToolSpec<S>,
  formats: ToolFormats = {}
): AiTool<BuiltSections<S>> & ProfileBrand {
  const { toolId, capabilities: declared, buildContracts: _, ...fields } = spec;
  refuseDirectory(toolId, spec.directory);
  const { value: toolSuffix } = new ToolSuffix(spec.toolSuffix);
  refuseWithoutBuildContract(toolId, spec.buildContracts);
  const contracts = contractsOf(spec.buildContracts, formats);
  const capabilities = buildSections(declared, { directory: spec.directory, toolSuffix, formats });
  refuseUnknownSections(toolId, capabilities);
  refuseDisagreeingPlugin(toolId, capabilities);
  refuseDisagreeingShippedConfig(toolId, spec.configAssets, capabilities);
  const profile = {
    ...fields,
    buildContracts: contracts,
    kind: "ai",
    toolId: toolId as AiToolId,
    section: sectionReader(capabilities),
    frameworkBuildMode: (): FrameworkBuildMode =>
      capabilities.layout?.mode === "flat" ? "flat" : "marketplace",
    buildContract: contractFor(toolId, contracts, capabilities),
    ...capabilityAnswers(spec, capabilities),
  };
  return profile as AiTool<BuiltSections<S>> & ProfileBrand;
}

export function defineIdeTool<C extends ProfileSections>(
  spec: IdeToolSpec<C>
): IdeToolConfig<C> & ProfileBrand {
  const { toolId, capabilities, ...fields } = spec;
  refuseDirectory(toolId, spec.directory);
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
