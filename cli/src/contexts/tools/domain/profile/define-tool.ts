import { isAbsolute, join } from "node:path";
import { InvalidToolProfileError } from "../../../../kernel/errors.js";
import {
  AI_TOOL_IDS,
  type AiToolId,
  IDE_TOOL_IDS,
  type IdeToolId,
} from "../../../../kernel/tool.js";
import type {
  ConfigWrite,
  FlatInstallSection,
  FlatSkillLayout,
  FrameworkBuildMode,
  PluginAnswers,
  SettingsFileAnswers,
  ShippedConfig,
} from "../../contract/tool-profile.js";
import type { SignalDirectory } from "../../contract/tool-vocabulary.js";
import type { MarketplaceRegistration } from "../native-registration/marketplace-registration.js";
import type { NativeActivation } from "../native-registration/native-activation.js";
import type { AiTool, IdeToolConfig } from "../profile.js";
import {
  isProfileSectionKey,
  type ProfileSection,
  type ProfileSectionKey,
  type ProfileSections,
} from "../profile.js";
import { AgentsSection } from "../sections/agents-section.js";
import { CommandsSection } from "../sections/commands-section.js";
import { RulesSection } from "../sections/rules-section.js";
import { SkillsSection } from "../sections/skills-section.js";
import { flatInstallPath, ownsFlatPath } from "./flat-install-paths.js";
import { deliverySuits, pluginAnswers, projectPlacement } from "./plugin-answers.js";
import { ToolSuffix } from "./tool-suffix.js";

/** Only `defineAiTool` and `defineIdeTool` can produce one: an object literal lacks the private
 * field, so a profile cannot skip the factory's refusals. */
export declare class ProfileBrand {
  private readonly profileBrand: true;
}

/** A profile only the factory could have produced. */
export type BuiltToolConfig = (AiTool | IdeToolConfig) & ProfileBrand;

type Unbound<P> = Omit<P, "directory" | "toolSuffix">;
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
  | "hostRefInUse"
  | "markdownSection"
  | "skillsSection"
  | "configFiles"
  | "runtimeFiles"
  | "configAssets"
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
    agents: (params) => new AgentsSection({ directory, toolSuffix, ...params }),
    skills: (params) => new SkillsSection({ directory, toolSuffix, ...params }),
    commands: (params) => new CommandsSection({ directory, toolSuffix, ...params }),
    rules: (params) => new RulesSection({ directory, toolSuffix, ...params }),
  };
}

/** Answers from the sections captured at construction, so the method survives being detached
 * and no caller reads the record itself. */
function sectionReader(
  sections: ProfileSections
): <K extends ProfileSectionKey>(key: K) => ProfileSection<K> | null {
  return (key) => sections[key] ?? null;
}

function aiConfigWrites(sections: ProfileSections): readonly ConfigWrite[] {
  return [
    ...(sections.mcp?.config === undefined
      ? []
      : [{ kind: "mcp" as const, capability: sections.mcp.config }]),
    ...(sections.hooks?.config === undefined
      ? []
      : [{ kind: "hooks" as const, capability: sections.hooks.config }]),
    ...settingsWrites(sections),
  ];
}

function settingsWrites(sections: ProfileSections): readonly ConfigWrite[] {
  return settingsOf(sections).map((capability) => ({ kind: "settings" as const, capability }));
}

function nativeActivationOf(sections: ProfileSections): NativeActivation | undefined {
  return sections.layout?.mode === "native" ? sections.layout.activation : undefined;
}

function settingsOf(sections: ProfileSections): readonly SettingsFileAnswers[] {
  return sections.config ?? [];
}

function signalDirectoryOf(signalDir: string | null, projectRoot: string): SignalDirectory | null {
  return signalDir === null
    ? null
    : { absolute: join(projectRoot, signalDir), relative: signalDir };
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

function skillLayoutOf(sections: ProfileSections): FlatSkillLayout {
  return sections.layout?.mode === "flat" ? sections.layout.skillLayout : "nested";
}

function refuse(toolId: string, detail: string): never {
  throw new InvalidToolProfileError(toolId, "plugin-sections-disagree", detail);
}

/** A layout, its manifest and its hooks delivery are one declaration: they agree or no profile. */
function refuseDisagreeingPlugin(toolId: string, sections: ProfileSections): void {
  const { layout, manifest, hooks } = sections;
  if (layout === undefined) {
    if (manifest !== undefined) refuse(toolId, "a manifest needs a native layout.");
    return;
  }
  if (layout.mode === "native" && manifest === undefined) {
    refuse(toolId, "a native layout requires a manifest section.");
  }
  if (layout.mode !== "native" && manifest !== undefined) {
    refuse(toolId, `a ${layout.mode} layout takes no manifest section.`);
  }
  if (hooks === undefined)
    refuse(toolId, "a layout requires a hooks section to state its delivery.");
  if (!deliverySuits(layout, hooks.delivery)) {
    refuse(
      toolId,
      `hooks delivery '${hooks.delivery.kind}' does not suit a ${layout.mode} layout.`
    );
  }
}

function pluginsOf(sections: ProfileSections): PluginAnswers | null {
  const { layout, hooks } = sections;
  if (layout === undefined || hooks === undefined) return null;
  return pluginAnswers(layout, sections.manifest ?? null, hooks, sections.mcp ?? null);
}

function marketplaceOf(sections: ProfileSections): MarketplaceRegistration | undefined {
  return sections.layout?.mode === "native" ? sections.layout.marketplace : undefined;
}

function destinationsOf(
  assets: readonly ShippedConfig[] | undefined,
  delivery: ShippedConfig["delivery"]
): Record<string, string> {
  return Object.fromEntries(
    (assets ?? [])
      .filter((asset) => asset.delivery === delivery)
      .map((a) => [a.name, a.destination])
  );
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
  refuseDisagreeingPlugin(toolId, capabilities);
  const plugins = pluginsOf(capabilities);
  const profile = {
    ...fields,
    kind: "ai",
    toolId,
    section: sectionReader(capabilities),
    frameworkBuildMode: (): FrameworkBuildMode =>
      capabilities.layout?.mode === "flat" ? "flat" : "marketplace",
    buildContract: (mode: FrameworkBuildMode) => contracts[mode]?.() ?? null,
    distributionPaths: (kind: "manifest" | "marketplace") =>
      fields.distributionProbes?.[kind] ?? [],
    flatInstallPath: (section: FlatInstallSection, pluginName: string, fileName: string) =>
      flatInstallPath(spec.directory, skillLayoutOf(capabilities), section, pluginName, fileName),
    ownsFlatPath: (relativePath: string, pluginName: string) =>
      ownsFlatPath(spec.directory, skillLayoutOf(capabilities), relativePath, pluginName),
    configWrites: () => aiConfigWrites(capabilities),
    plugins: () => plugins,
    supportsUserScopeActivation: () => plugins?.supportsUserScopeActivation() ?? false,
    markdownSection: (kind: "commands" | "agents" | "rules") => capabilities[kind] ?? null,
    skillsSection: () => capabilities.skills ?? null,
    nativeActivation: () => nativeActivationOf(capabilities),
    hostRefInUse: (enabled: boolean) =>
      nativeActivationOf(capabilities)?.takesRefForInUse(enabled) ?? true,
    configFiles: () => ({
      ...destinationsOf(spec.configAssets, "install"),
      ...destinationsOf(spec.configAssets, "runtime"),
    }),
    runtimeFiles: () => destinationsOf(spec.configAssets, "runtime"),
    configAssets: (): readonly ShippedConfig[] => spec.configAssets ?? [],
    mcpConfig: () => capabilities.mcp?.config ?? null,
    flatPluginMcp: () =>
      capabilities.mcp?.config?.mergeStrategy() === "framework-prime" &&
      capabilities.layout?.mode === "flat"
        ? capabilities.mcp.config
        : null,
    settingsFiles: () => settingsOf(capabilities),
    marketplaceRegistration: () => marketplaceOf(capabilities) ?? null,
    machineLocalFiles: () => marketplaceOf(capabilities)?.machineLocalFiles() ?? [],
    installedRulesLocation: () => capabilities.rules?.installedLocation() ?? null,
    pluginEnablementIsMachineGlobal: () =>
      capabilities.layout?.mode === "native"
        ? capabilities.layout.activation?.scopesEnablement() !== true
        : true,
    signalDirectoryIn: (projectRoot: string) => signalDirectoryOf(spec.signalDir, projectRoot),
    projectHooksDelivery: () => {
      const placement =
        capabilities.hooks === undefined ? null : projectPlacement(capabilities.hooks.delivery);
      return placement === null ? null : { ...placement, toolName: spec.displayName };
    },
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
    configWrites: () => settingsWrites(capabilities),
    settingsFiles: () => settingsOf(capabilities),
    configAssets: (): readonly ShippedConfig[] => spec.configAssets ?? [],
    signalDirectoryIn: (projectRoot: string) => signalDirectoryOf(spec.signalDir, projectRoot),
    machineLocalFiles: (): readonly string[] => [],
  };
  return profile as IdeToolConfig<C> & ProfileBrand;
}
