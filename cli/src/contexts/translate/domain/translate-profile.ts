import type { ToolBuildContract } from "../../../shared/domain/materialization/build-contract.js";
import type { LinkSyntax } from "../../../shared/domain/materialization/link-syntax.js";
import type { AiToolId } from "../../../shared/domain/tool.js";

/** Output layout of a build: a marketplace dist versus a flat workspace inject. */
export type FrameworkBuildMode = "marketplace" | "flat";

/** The sections a flat plugin's files are installed under. */
export type FlatInstallSection = "commands" | "agents" | "rules" | "skills";

/** Whether a delivered hook runs on the tool, and why not when it does not. */
export type HooksAcceptance = { accepts: true } | { accepts: false; reason: string };

/** A tool that installs a plugin through its own plugin CLI, as far as the engine asks it. */
export interface TranslatedNativePlugin {
  readonly kind: "native";
  hooksAcceptance(): HooksAcceptance;
  pluginOutputDir(pluginName: string): string;
  manifestPath(): string | null;
  rootToken(): string;
  trustNotice(): string | null;
  mcpFile(): { accepts: boolean; relativePath: string };
  hooksFilePath(): string;
  hookScript(pluginPath: string, content: string): string;
}

/** A tool whose plugins are injected into the project tree, as far as the engine asks it. */
export interface TranslatedFlatPlugin {
  readonly kind: "flat";
  hooksAcceptance(): HooksAcceptance;
  flatLayout(): { readonly namespacePrefix: string };
  hookScript(pluginPath: string, content: string): string;
}

/** A tool that takes no plugin. */
export interface TranslatedNoPlugin {
  readonly kind: "unsupported";
}

export type TranslatedPlugins = TranslatedNativePlugin | TranslatedFlatPlugin | TranslatedNoPlugin;

/** A markdown section (commands, agents, rules) the engine installs a file under. */
export interface TranslatedMarkdownSection {
  buildInstallPath(fileName: string): string | null;
  convertFrontmatter(fm: Record<string, unknown>, fileName: string): Record<string, unknown>;
  readonly serialize?: (fm: Record<string, unknown>, body: string) => string;
}

/** Where a tool takes a plugin's hooks inside the project. */
export interface TranslatedProjectHooks {
  readonly format: { scriptPath(pluginName: string, hooksRelativePath: string): string };
  hookScript(pluginPath: string, content: string): string;
}

/** The part of an AI tool the engine reads. The tools context owns the profile, and composition
 * hands over the real one, which satisfies this by shape. */
export interface TranslatedAiTool {
  readonly kind: "ai";
  readonly toolId: AiToolId;
  readonly directory: string;
  buildContract(mode: FrameworkBuildMode, provider?: string): ToolBuildContract | null;
  flatInstallPath(section: FlatInstallSection, pluginName: string, fileName: string): string;
  readonly linkSyntax: LinkSyntax;
  plugins(): TranslatedPlugins | null;
  /** Where the tool keeps a plugin's hooks in the project, or null when its plugins carry their own. */
  projectHooksDelivery(): TranslatedProjectHooks | null;
  markdownSection(kind: "commands" | "agents" | "rules"): TranslatedMarkdownSection | null;
  declaresSkills(): boolean;
  /** The config a flat install folds the plugin's servers into, or null when plugins carry their own. */
  flatPluginMcp(): { transform(mcpJson: string): string } | null;
}

/** An editor has nothing to translate: the engine answers it with no files. */
export interface UntranslatedTool {
  readonly kind: "ide";
}

export type TranslateProfile = TranslatedAiTool | UntranslatedTool;

/** The registered tools, as far as the layout probes read them. */
export interface TranslateToolCatalog {
  inHelpOrder(category: "ai"): readonly AiToolId[];
  aiProfile(id: AiToolId): {
    distributionPaths(kind: "manifest" | "marketplace"): readonly string[];
  };
}
