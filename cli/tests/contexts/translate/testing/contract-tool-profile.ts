import type { ToolBuildContract } from "../../../../src/contexts/tools/contract/build-contract.js";
import type {
  AiToolProfile,
  FlatInstallSection,
  FrameworkBuildMode,
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

/** A tool as the contract states it: the base's answers, but for the ones given. */
export function contractToolProfile(
  base: AiToolProfile,
  answers: ProfileAnswers = {}
): AiToolProfile {
  const { sections = {}, plugins, flatContract } = answers;
  return Object.create(base, {
    directory: { value: answers.directory ?? base.directory },
    plugins: { value: () => (plugins === undefined ? base.plugins() : plugins) },
    markdownSection: {
      value: (kind: "commands" | "agents" | "rules") =>
        sections[kind] === undefined ? base.markdownSection(kind) : sections[kind],
    },
    skillsSection: {
      value: () => (sections.skills === undefined ? base.skillsSection() : sections.skills),
    },
    buildContract: {
      value: (mode: FrameworkBuildMode, provider?: string) =>
        mode === "flat" && flatContract !== undefined
          ? flatContract
          : base.buildContract(mode, provider),
    },
    flatInstallPath: {
      value:
        answers.flatInstallPath ??
        ((section: FlatInstallSection, pluginName: string, fileName: string) =>
          base.flatInstallPath(section, pluginName, fileName)),
    },
    rewriteContent: {
      value: answers.rewriteContent ?? ((content: string) => base.rewriteContent(content)),
    },
  });
}
