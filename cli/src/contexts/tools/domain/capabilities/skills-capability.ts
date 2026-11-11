import { CapabilityConfigError } from "../../../../kernel/errors.js";
import { serializeFrontmatter } from "../../../../kernel/markdown.js";
import { ForeignSuffixFilter } from "../profile/foreign-suffix-filter.js";

const AGENTS_SKILLS_PREFIX = ".agents/skills/";

type SkillsCapabilityParams = {
  directory?: string;
  toolSuffix?: string;
  prefix?: string;
  buildInstallPath: (fileName: string) => string | null;
  convertFrontmatter: (fm: Record<string, unknown>) => Record<string, unknown>;
};

export class SkillsCapability {
  readonly #params: SkillsCapabilityParams;
  readonly #foreignSuffixes: ForeignSuffixFilter;

  constructor(params: SkillsCapabilityParams) {
    this.#params = params;
    if (!params.prefix && !params.directory) {
      throw new CapabilityConfigError("SkillsCapability requires either prefix or directory");
    }
    this.#foreignSuffixes = ForeignSuffixFilter.keeping(params.toolSuffix ?? "");
  }

  buildOutputPath(skillName: string): string {
    if (this.#params.prefix !== undefined) {
      return `${AGENTS_SKILLS_PREFIX}${this.#params.prefix}${skillName}/SKILL.md`;
    }
    return `${this.#params.directory}skills/${skillName}${this.#params.toolSuffix ?? ""}`;
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
    if (this.#params.prefix !== undefined) {
      return relativePath.startsWith(AGENTS_SKILLS_PREFIX);
    }
    return relativePath.startsWith(this.#params.directory ?? "");
  }

  equals(other: SkillsCapability): boolean {
    return (
      this.#params.directory === other.#params.directory &&
      this.#params.toolSuffix === other.#params.toolSuffix &&
      this.#params.prefix === other.#params.prefix
    );
  }
}
