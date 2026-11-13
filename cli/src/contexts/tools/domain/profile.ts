import type { AiToolId, IdeToolId } from "../../../kernel/tool.js";
import type { ToolBuildContract } from "../contract/build-contract.js";
import type { AiToolProfile, IdeToolProfile, PluginAnswers } from "../contract/tool-profile.js";
import type { NativeActivation } from "./native-registration/native-activation.js";
import type { AgentsSection } from "./sections/agents-section.js";
import type { CommandsSection } from "./sections/commands-section.js";
import type { ConfigSection } from "./sections/config-section.js";
import type { HooksSection } from "./sections/hooks-section.js";
import type { LayoutSection } from "./sections/layout-section.js";
import type { ManifestSection } from "./sections/manifest-section.js";
import type { McpSection } from "./sections/mcp-section.js";
import type { RulesSection } from "./sections/rules-section.js";
import type { SkillsSection } from "./sections/skills-section.js";

/** What a tool can declare, by the key it declares it under. */
export interface ProfileSections {
  agents?: AgentsSection;
  skills?: SkillsSection;
  commands?: CommandsSection;
  rules?: RulesSection;
  mcp?: McpSection;
  hooks?: HooksSection;
  layout?: LayoutSection;
  manifest?: ManifestSection;
  config?: ConfigSection[];
}

export type ProfileSectionKey = keyof ProfileSections;

/** What a declared section is: the type under `key`, without the `undefined` of an absent one. */
export type ProfileSection<K extends ProfileSectionKey> = NonNullable<ProfileSections[K]>;

export const PROFILE_SECTION_KEYS: readonly ProfileSectionKey[] = [
  "agents",
  "skills",
  "commands",
  "rules",
  "mcp",
  "hooks",
  "layout",
  "manifest",
  "config",
];

export function isProfileSectionKey(name: string): name is ProfileSectionKey {
  return PROFILE_SECTION_KEYS.some((key) => key === name);
}

/** The declared type of a tool that holds every section named in `K`. */
export type WithSections<K extends ProfileSectionKey> = Pick<Required<ProfileSections>, K>;

/** The section keys a tool's own type declares, so asking for one needs no `null` check. */
type DeclaredKey<C extends ProfileSections> = {
  [K in ProfileSectionKey]-?: undefined extends C[K] ? never : K;
}[ProfileSectionKey];

export interface AiTool<C extends ProfileSections = ProfileSections> extends AiToolProfile {
  readonly kind: "ai";
  readonly toolId: AiToolId;
  /** How the vendor writes it. `toolId` is a key, not a name: nothing user-facing
   * should print `copilot` where a person reads "GitHub Copilot". */
  readonly displayName: string;
  readonly directory: string;
  readonly toolSuffix: string;
  readonly signalDir: string | null;
  /** The tool's framework-build contracts, one per supported build mode, so the build registry
   * is derived from the registered tools instead of a hand-kept list of tool/mode pairs. */
  readonly buildContracts: {
    readonly marketplace?: () => ToolBuildContract;
    readonly flat?: () => ToolBuildContract;
  };
  /** Where this tool's plugin manifest and marketplace catalog sit inside a distribution it
   * produced, so a sixth tool declares its own layout instead of joining two lists it does not
   * own. Order is irrelevant: the collected probes are sorted deepest-path-first, so a specific
   * location always wins over a bare `plugin.json` at the root. */
  readonly distributionProbes?: {
    readonly manifest?: readonly string[];
    readonly marketplace?: readonly string[];
  };
  rewriteContent(content: string): string;
  /** The section declared under `key`, or `null` when the tool declares none. A key the tool's
   * own type declares answers without `null`. */
  section<K extends DeclaredKey<C>>(key: K): NonNullable<C[K]>;
  section<K extends ProfileSectionKey>(key: K): ProfileSection<K> | null;
  /** How the tool takes plugins, composed from its layout, manifest, hooks and mcp sections, or
   * null when it declares no layout. */
  plugins(): PluginAnswers | null;
  /** The native plugin CLI declaration of a native layout, or undefined. */
  nativeActivation(): NativeActivation | undefined;
}

export interface IdeToolConfig<C extends ProfileSections = ProfileSections> extends IdeToolProfile {
  readonly kind: "ide";
  readonly toolId: IdeToolId;
  readonly directory: string;
  readonly signalDir: string | null;
  section<K extends DeclaredKey<C>>(key: K): NonNullable<C[K]>;
  section<K extends ProfileSectionKey>(key: K): ProfileSection<K> | null;
}
