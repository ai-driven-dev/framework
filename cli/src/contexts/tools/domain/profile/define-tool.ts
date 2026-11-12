import { isAbsolute } from "node:path";
import { InvalidToolProfileError } from "../../../../kernel/errors.js";
import {
  AI_TOOL_IDS,
  type AiToolId,
  IDE_TOOL_IDS,
  type IdeToolId,
} from "../../../../kernel/tool.js";
import type { FrameworkBuildMode, SettingsFileAnswers } from "../../contract/tool-profile.js";
import { AgentsCapability } from "../capabilities/agents-capability.js";
import { CommandsCapability } from "../capabilities/commands-capability.js";
import { RulesCapability } from "../capabilities/rules-capability.js";
import { SkillsCapability } from "../capabilities/skills-capability.js";
import type { AiTool, ConfigCapability, IdeToolConfig } from "../contracts.js";
import type { NativeActivation } from "../plugins/native-activation.js";
import {
  isProfileSectionKey,
  type ProfileSection,
  type ProfileSectionKey,
  type ProfileSections,
} from "./profile-sections.js";
import { ToolSuffix } from "./tool-suffix.js";

/** Only `defineAiTool` and `defineIdeTool` can produce one: an object literal lacks the private
 * field, so a profile cannot skip the factory's refusals. */
export declare class ProfileBrand {
  private readonly profileBrand: true;
}

type Unbound<P> = Omit<P, "directory" | "toolSuffix">;
type ParamsOf<T extends new (params: never) => unknown> = ConstructorParameters<T>[0];

/** The directory and suffix a profile states once. Its section builders carry both, so a
 * profile never repeats them. */
export interface BoundTool {
  /** Where a built file lands: `<directory><subdirectory><name without the tool suffix>`. */
  installUnder(subdirectory: string): (fileName: string) => string;
  agents(params: Unbound<ParamsOf<typeof AgentsCapability>>): AgentsCapability;
  skills(params: Unbound<ParamsOf<typeof SkillsCapability>>): SkillsCapability;
  commands(params: Unbound<ParamsOf<typeof CommandsCapability>>): CommandsCapability;
  rules(params: Unbound<ParamsOf<typeof RulesCapability>>): RulesCapability;
}

type AiToolFields = Omit<
  AiTool<ProfileSections>,
  | "kind"
  | "toolId"
  | "section"
  | "buildContract"
  | "configCapabilities"
  | "plugins"
  | "supportsUserScopeActivation"
  | "nativeActivation"
  | "markdownSection"
  | "skillsSection"
  | "configFiles"
  | "runtimeFiles"
  | "mcpConfig"
  | "settingsFiles"
  | "machineLocalFiles"
>;

export interface AiToolSpec<C extends ProfileSections> extends AiToolFields {
  readonly toolId: string;
  readonly capabilities: (bound: BoundTool) => C;
}

export interface IdeToolSpec<C extends ProfileSections> {
  readonly toolId: string;
  readonly directory: string;
  readonly signalDir: string | null;
  readonly capabilities: () => C;
}

function refuseDirectory(toolId: string, directory: string): void {
  if (isAbsolute(directory)) {
    throw new InvalidToolProfileError(
      toolId,
      "directory-not-relative",
      `'${directory}' must be relative to the project root.`
    );
  }
  if (!directory.endsWith("/")) {
    throw new InvalidToolProfileError(
      toolId,
      "directory-without-trailing-slash",
      `'${directory}' must end with '/'.`
    );
  }
}

function refuseUnknownSections(toolId: string, sections: ProfileSections): void {
  for (const key of Object.keys(sections)) {
    if (!isProfileSectionKey(key)) {
      throw new InvalidToolProfileError(toolId, "unknown-section", `'${key}' is no section.`);
    }
  }
}

function bind(directory: string, suffix: ToolSuffix): BoundTool {
  const toolSuffix = suffix.value;
  return {
    installUnder: (subdirectory) => (fileName) =>
      `${directory}${subdirectory}${suffix.strip(fileName)}`,
    agents: (params) => new AgentsCapability({ directory, toolSuffix, ...params }),
    skills: (params) => new SkillsCapability({ directory, toolSuffix, ...params }),
    commands: (params) => new CommandsCapability({ directory, toolSuffix, ...params }),
    rules: (params) => new RulesCapability({ directory, toolSuffix, ...params }),
  };
}

/** Answers from the sections captured at construction, so the method survives being detached
 * and no caller reads the record itself. */
function sectionReader(
  sections: ProfileSections
): <K extends ProfileSectionKey>(key: K) => ProfileSection<K> | null {
  return (key) => sections[key] ?? null;
}

function aiConfigCapabilities(sections: ProfileSections): ConfigCapability[] {
  return [
    ...(sections.mcp === undefined ? [] : [sections.mcp]),
    ...(sections.hooks === undefined ? [] : [sections.hooks]),
    ...(sections.settings ?? []),
  ];
}

function nativeActivationOf(sections: ProfileSections): NativeActivation | undefined {
  const plugins = sections.plugins;
  return plugins?.kind === "native" ? (plugins.activation() ?? undefined) : undefined;
}

function settingsOf(sections: ProfileSections): readonly SettingsFileAnswers[] {
  return sections.settings ?? [];
}

function machineLocalFilesOf(sections: ProfileSections): readonly string[] {
  const plugins = sections.plugins;
  return plugins?.kind === "native"
    ? (plugins.marketplaceRegistration()?.machineLocalFiles() ?? [])
    : [];
}

function aiToolId(id: string): AiToolId {
  const known = AI_TOOL_IDS.find((candidate) => candidate === id);
  if (known === undefined) {
    throw new InvalidToolProfileError(id, "unknown-tool-id", `no AI tool is named '${id}'.`);
  }
  return known;
}

function ideToolId(id: string): IdeToolId {
  const known = IDE_TOOL_IDS.find((candidate) => candidate === id);
  if (known === undefined) {
    throw new InvalidToolProfileError(id, "unknown-tool-id", `no IDE tool is named '${id}'.`);
  }
  return known;
}

export function defineAiTool<C extends ProfileSections>(
  spec: AiToolSpec<C>
): AiTool<C> & ProfileBrand {
  const { toolId: id, capabilities: declare, ...fields } = spec;
  const toolId = aiToolId(id);
  refuseDirectory(toolId, spec.directory);
  const suffix = new ToolSuffix(spec.toolSuffix);
  const contracts = spec.buildContracts;
  if (contracts.marketplace === undefined && contracts.flat === undefined) {
    throw new InvalidToolProfileError(
      toolId,
      "no-build-contract",
      "an AI tool declares a marketplace or a flat build contract."
    );
  }
  const capabilities = declare(bind(spec.directory, suffix));
  refuseUnknownSections(toolId, capabilities);
  const profile = {
    ...fields,
    kind: "ai",
    toolId,
    section: sectionReader(capabilities),
    buildContract: (mode: FrameworkBuildMode) => contracts[mode]?.() ?? null,
    configCapabilities: () => aiConfigCapabilities(capabilities),
    plugins: () => capabilities.plugins ?? null,
    supportsUserScopeActivation: () => capabilities.plugins?.supportsUserScopeActivation() ?? false,
    markdownSection: (kind: "commands" | "agents" | "rules") => capabilities[kind] ?? null,
    skillsSection: () => capabilities.skills ?? null,
    nativeActivation: () => nativeActivationOf(capabilities),
    configFiles: () => ({ ...fields.configOutputPaths, ...fields.pluginRuntimeFiles }),
    runtimeFiles: () => ({ ...fields.pluginRuntimeFiles }),
    mcpConfig: () => capabilities.mcp ?? null,
    settingsFiles: () => settingsOf(capabilities),
    machineLocalFiles: () => machineLocalFilesOf(capabilities),
  };
  return profile as AiTool<C> & ProfileBrand;
}

export function defineIdeTool<C extends ProfileSections>(
  spec: IdeToolSpec<C>
): IdeToolConfig<C> & ProfileBrand {
  const { toolId: id, capabilities: declare, ...fields } = spec;
  const toolId = ideToolId(id);
  refuseDirectory(toolId, spec.directory);
  const capabilities = declare();
  refuseUnknownSections(toolId, capabilities);
  const profile = {
    ...fields,
    kind: "ide",
    toolId,
    section: sectionReader(capabilities),
    configCapabilities: () => [...(capabilities.settings ?? [])],
    settingsFiles: () => settingsOf(capabilities),
  };
  return profile as IdeToolConfig<C> & ProfileBrand;
}
