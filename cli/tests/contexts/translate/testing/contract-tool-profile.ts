import type { ToolBuildContract } from "../../../../src/contexts/tools/contract/build-contract.js";
import type {
  AiToolProfile,
  FlatInstallSection,
  MarkdownSectionAnswers,
  PluginAnswers,
  SkillsSectionAnswers,
} from "../../../../src/contexts/tools/contract/tool-profile.js";

/** The sections a stand-in declares in place of its base's: `null` drops one, absent keeps it. */
export interface SectionAnswers {
  readonly commands?: MarkdownSectionAnswers | null;
  readonly agents?: MarkdownSectionAnswers | null;
  readonly rules?: MarkdownSectionAnswers | null;
  readonly skills?: SkillsSectionAnswers | null;
}

/** What a stand-in answers differently from its base, everything the translator asks of a tool. */
export interface ProfileAnswers {
  readonly directory?: string;
  /** `null` is a tool that takes no plugin; absent keeps the base's. */
  readonly plugins?: PluginAnswers | null;
  readonly sections?: SectionAnswers;
  /** `null` is a tool declaring no flat contract; absent keeps the base's. */
  readonly flatContract?: ToolBuildContract | null;
  readonly flatInstallPath?: (
    section: FlatInstallSection,
    pluginName: string,
    fileName: string
  ) => string;
  readonly rewriteContent?: (content: string) => string;
}

/** The base itself, its own members replaced by `overrides`. */
function derived<Base extends object>(base: Base, overrides: Partial<Base>): Base {
  const own = Object.fromEntries(
    Object.entries(overrides).map(([name, value]) => [name, { value }])
  );
  return Object.create(base, own);
}

/** A tool as the contract states it: the base's answers, but for the ones given. */
export function contractToolProfile(
  base: AiToolProfile,
  answers: ProfileAnswers = {}
): AiToolProfile {
  const { sections = {}, plugins, flatContract } = answers;
  const overrides = {
    directory: answers.directory ?? base.directory,
    plugins: () => (plugins === undefined ? base.plugins() : plugins),
    markdownSection: (kind) =>
      sections[kind] === undefined ? base.markdownSection(kind) : sections[kind],
    skillsSection: () => (sections.skills === undefined ? base.skillsSection() : sections.skills),
    buildContract: (mode, provider) =>
      mode === "flat" && flatContract !== undefined
        ? flatContract
        : base.buildContract(mode, provider),
    flatInstallPath:
      answers.flatInstallPath ??
      ((section, pluginName, fileName) => base.flatInstallPath(section, pluginName, fileName)),
    rewriteContent: answers.rewriteContent ?? ((content) => base.rewriteContent(content)),
  } satisfies Pick<
    AiToolProfile,
    | "directory"
    | "plugins"
    | "markdownSection"
    | "skillsSection"
    | "buildContract"
    | "flatInstallPath"
    | "rewriteContent"
  >;
  return derived(base, overrides);
}
