import {
  type FlatArtifactLayout,
  flatRulesPlacement,
  rulesGlobOf,
} from "../../../../shared/domain/materialization/flat-paths.js";
import type { RulesIndexAnswers } from "../../contract/tool-profile.js";
import {
  AGENTS_FILE,
  addAgentsRulesGlob,
  removeAgentsRulesGlob,
} from "../formats/agents-rules-index.js";

type RulesSectionParams = {
  toolSuffix: string;
  inputSuffix?: string;
  /** The tool reads markdown guidance only from AGENTS.md, so the rules it is given are listed
   * there: the layout is where they sit in a project. */
  listedInAgentsFile?: FlatArtifactLayout;
  buildInstallPath: (fileName: string) => string | null;
  convertFrontmatter: (fm: Record<string, unknown>) => Record<string, unknown>;
};

export class RulesSection {
  readonly #params: RulesSectionParams;

  constructor(params: RulesSectionParams) {
    this.#params = params;
  }

  /** A name no rule of a reader's own will ever carry, asked of `buildInstallPath` only so its
   * answer can be read back. Long on purpose: it reaches no output and no disk, and a short one
   * could collide with a real rule name. */
  static readonly #PROBE_STEM = "aidd-installed-location-probe";

  /** Where an installed rule of this tool lives, and what it is called at the end, asked of the
   * installer rather than restated beside it: a reader scanning a project needs the *installed*
   * shape, and only `buildInstallPath`: a closure written per tool: knows it. `null` when the tool
   * installs nothing for the name asked about, or answers a path whose stem it rewrote past
   * recognition; neither is a guess. */
  installedLocation(): { readonly directory: string; readonly extension: string } | null {
    const suffix = this.#params.inputSuffix ?? this.#params.toolSuffix;
    const installed = this.buildInstallPath(`${RulesSection.#PROBE_STEM}${suffix}`);
    if (installed === null) return null;
    const lastSlash = installed.lastIndexOf("/");
    const stemAt = installed.indexOf(RulesSection.#PROBE_STEM, lastSlash + 1);
    if (stemAt === -1) return null;
    return {
      directory: installed.slice(0, lastSlash + 1),
      extension: installed.slice(stemAt + RulesSection.#PROBE_STEM.length),
    };
  }

  /** The file listing a plugin's rules, for a tool that reads no rules folder; null for any other. */
  agentsIndex(): RulesIndexAnswers | null {
    const layout = this.#params.listedInAgentsFile;
    if (layout === undefined) return null;
    return {
      relativePath: AGENTS_FILE,
      globIn: (plugin, paths) => rulesGlobOf(flatRulesPlacement(layout, plugin), paths),
      globOf: (plugin) => flatRulesPlacement(layout, plugin)?.glob ?? null,
      withGlob: addAgentsRulesGlob,
      withoutGlob: removeAgentsRulesGlob,
    };
  }

  buildInstallPath(fileName: string): string | null {
    return this.#params.buildInstallPath(fileName);
  }

  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return this.#params.convertFrontmatter(fm);
  }
}
