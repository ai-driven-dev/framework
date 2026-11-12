import { CapabilityConfigError } from "../../../../kernel/errors.js";
import { serializeFrontmatter } from "../../../../kernel/markdown.js";
import { ForeignSuffixFilter } from "../profile/foreign-suffix-filter.js";

const AGENTS_SKILLS_PREFIX = ".agents/skills/";

type SkillsSectionParams = {
  directory?: string;
  toolSuffix?: string;
  agentsSkillsDirectory?: boolean;
  buildInstallPath: (fileName: string) => string | null;
  convertFrontmatter: (fm: Record<string, unknown>) => Record<string, unknown>;
};

export class SkillsSection {
  readonly #params: SkillsSectionParams;
  readonly #foreignSuffixes: ForeignSuffixFilter;

  constructor(params: SkillsSectionParams) {
    this.#params = params;
    if (!params.agentsSkillsDirectory && !params.directory) {
      throw new CapabilityConfigError(
        "SkillsSection requires either agentsSkillsDirectory or directory"
      );
    }
    this.#foreignSuffixes = ForeignSuffixFilter.keeping(params.toolSuffix ?? "");
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
    if (this.#params.agentsSkillsDirectory) {
      return relativePath.startsWith(AGENTS_SKILLS_PREFIX);
    }
    return relativePath.startsWith(this.#params.directory ?? "");
  }

  equals(other: SkillsSection): boolean {
    return (
      this.#params.directory === other.#params.directory &&
      this.#params.toolSuffix === other.#params.toolSuffix &&
      this.#params.agentsSkillsDirectory === other.#params.agentsSkillsDirectory
    );
  }
}
