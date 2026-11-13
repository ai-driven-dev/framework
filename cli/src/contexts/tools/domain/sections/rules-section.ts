import { serializeFrontmatter } from "../../../../shared/domain/markdown.js";
import { ForeignSuffixFilter } from "../profile/foreign-suffix-filter.js";

type RulesSectionParams = {
  directory: string;
  toolSuffix: string;
  inputSuffix?: string;
  buildInstallPath: (fileName: string) => string | null;
  convertFrontmatter: (fm: Record<string, unknown>) => Record<string, unknown>;
};

export class RulesSection {
  readonly #params: RulesSectionParams;
  readonly #foreignSuffixes: ForeignSuffixFilter;

  constructor(params: RulesSectionParams) {
    this.#params = params;
    this.#foreignSuffixes = ForeignSuffixFilter.keeping(params.inputSuffix ?? params.toolSuffix);
  }

  /** A name no rule of a reader's own will ever carry, asked of `buildInstallPath` only so its
   * answer can be read back. Long on purpose: it reaches no output and no disk, and a short one
   * could collide with a real rule name. */
  static readonly #PROBE_STEM = "aidd-installed-location-probe";

  /** Where an installed rule of this tool lives, and what it is called at the end, asked of the
   * installer rather than restated beside it: a reader scanning a project needs the *installed*
   * shape, and only `buildInstallPath` — a closure written per tool — knows it. `null` when the tool
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

  buildInstallPath(fileName: string): string | null {
    return this.#params.buildInstallPath(fileName);
  }

  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return this.#params.convertFrontmatter(fm);
  }

  acceptsFileName(fileName: string): boolean {
    return this.#foreignSuffixes.accepts(fileName);
  }

  serialize(frontmatter: Record<string, unknown>, body: string): string {
    return serializeFrontmatter(frontmatter, body);
  }

  accepts(relativePath: string): boolean {
    return relativePath.startsWith(this.#params.directory);
  }

  equals(other: RulesSection): boolean {
    return (
      this.#params.directory === other.#params.directory &&
      this.#params.toolSuffix === other.#params.toolSuffix
    );
  }
}
