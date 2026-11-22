import type { ToolBuildContract } from "../../../../src/contexts/tools/contract/build-contract.js";
import type { LinkSyntax } from "../../../../src/contexts/tools/contract/link-syntax.js";
import type {
  AiToolProfile,
  FlatInstallSection,
  MarkdownSectionAnswers,
  PluginAnswers,
} from "../../../../src/contexts/tools/contract/tool-profile.js";

/** The sections a stand-in declares in place of its base's: `null` drops one, absent keeps it. */
export interface SectionAnswers {
  readonly commands?: MarkdownSectionAnswers | null;
  readonly agents?: MarkdownSectionAnswers | null;
  readonly rules?: MarkdownSectionAnswers | null;
  /** `null` drops the skills section the base declares. */
  readonly skills?: null;
}

/** What a stand-in answers differently from its base, everything the translator asks of a tool. */
export interface ProfileAnswers {
  readonly directory?: string;
  /** `null` is a tool that takes no plugin; absent keeps the base's. */
  readonly plugins?: PluginAnswers | null;
  readonly sections?: SectionAnswers;
  /** `null` is a tool declaring no flat contract; absent keeps the base's. */
  readonly flatContract?: ToolBuildContract | null;
  /** The marketplace contract a stand-in answers; absent keeps the base's. */
  readonly marketplaceContract?: ToolBuildContract;
  readonly flatInstallPath?: (
    section: FlatInstallSection,
    pluginName: string,
    fileName: string
  ) => string;
  readonly linkSyntax?: LinkSyntax;
}

/** `overrides` as own members of an object derived from another. */
export function ownMembers(overrides: object): PropertyDescriptorMap {
  return Object.fromEntries(Object.entries(overrides).map(([name, value]) => [name, { value }]));
}

/** The base itself, its own members replaced by `overrides`. */
function derived<Base extends object>(base: Base, overrides: Partial<Base>): Base {
  return Object.create(base, ownMembers(overrides));
}

/** A tool as the contract states it: the base's answers, but for the ones given. */
export function contractToolProfile(
  base: AiToolProfile,
  answers: ProfileAnswers = {}
): AiToolProfile {
  const { sections = {}, plugins, flatContract, marketplaceContract } = answers;
  const overrides = {
    directory: answers.directory ?? base.directory,
    plugins: () => (plugins === undefined ? base.plugins() : plugins),
    markdownSection: (kind) =>
      sections[kind] === undefined ? base.markdownSection(kind) : sections[kind],
    declaresSkills: () =>
      sections.skills === undefined ? base.declaresSkills() : sections.skills !== null,
    buildContract: (mode, provider) => {
      if (mode === "flat" && flatContract !== undefined) return flatContract;
      if (mode === "marketplace" && marketplaceContract !== undefined) return marketplaceContract;
      return base.buildContract(mode, provider);
    },
    flatInstallPath:
      answers.flatInstallPath ??
      ((section, pluginName, fileName) => base.flatInstallPath(section, pluginName, fileName)),
    linkSyntax: answers.linkSyntax ?? base.linkSyntax,
  } satisfies Pick<
    AiToolProfile,
    | "directory"
    | "plugins"
    | "markdownSection"
    | "declaresSkills"
    | "buildContract"
    | "flatInstallPath"
    | "linkSyntax"
  >;
  return derived(base, overrides);
}
