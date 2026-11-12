import type { AiToolId, IdeToolId } from "../../../kernel/tool.js";
import type { ToolBuildContract } from "../contract/build-contract.js";
import type { AiToolProfile, IdeToolProfile } from "../contract/tool-profile.js";
import type { AgentsCapability } from "./capabilities/agents-capability.js";
import type { NativeActivation } from "./plugins/native-activation.js";
import type { PluginsCapability } from "./plugins/plugins-capability.js";
import type {
  ProfileSection,
  ProfileSectionKey,
  ProfileSections,
} from "./profile/profile-sections.js";

export interface HasAgents {
  readonly agents: AgentsCapability;
}

export interface HasPlugins {
  readonly plugins: PluginsCapability;
}

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
  readonly configOutputPaths?: Readonly<Record<string, string>>;
  /** Bundled runtime modules required by plugins, owned by the tool rather than one plugin. */
  readonly pluginRuntimeFiles?: Readonly<Record<string, string>>;
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
  /** The plugins section the tool declares, or null. */
  plugins(): PluginsCapability | null;
  /** The native plugin CLI declaration of a native plugins capability, or undefined. */
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
