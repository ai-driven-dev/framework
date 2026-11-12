import type { AiToolId, IdeToolId } from "../../../kernel/tool.js";

/** One variable, as the caller reads it: a profile is a declaration and reaches no global. */
export type EnvironmentReader = (name: string) => string | undefined;

/** How a tool takes plugins, asked and never read: each answer is a method. */
export interface PluginDelivery {
  /** Whether `--scope user` has anywhere to point this tool. */
  supportsUserScopeActivation(): boolean;
  /** Whether a machine-scope install writes the plugin's files itself. */
  copiesFilesGlobally(): boolean;
  /** Where a machine-scope install puts a plugin's files under `homedir`, or null for none. */
  userPluginsBaseDir(homedir: string): string | null;
}

/** What a tool's own plugin CLI declares about itself. */
export interface NativeActivationAnswers {
  /** The host's own user-scope settings file under `home`, or undefined when none is declared. */
  userSettingsFile(home: string, env: EnvironmentReader): string | undefined;
}

/** An AI assistant, as an outside caller asks it. */
export interface AiToolProfile {
  readonly kind: "ai";
  readonly toolId: AiToolId;
  /** The tool's plugin delivery, or null when it declares none. */
  plugins(): PluginDelivery | null;
  /** The tool's native plugin CLI declaration, or undefined when it has none. */
  nativeActivation(): NativeActivationAnswers | undefined;
}

/** An editor, as an outside caller asks it. */
export interface IdeToolProfile {
  readonly kind: "ide";
  readonly toolId: IdeToolId;
}

export type ToolProfile = AiToolProfile | IdeToolProfile;
