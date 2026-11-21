import { serializeFrontmatter } from "../../../../shared/domain/markdown.js";
import { CapabilityConfigError } from "../tools.error.js";

type SkillsSectionParams = {
  directory?: string;
  toolSuffix?: string;
  agentsSkillsDirectory?: boolean;
  buildInstallPath: (fileName: string) => string | null;
  convertFrontmatter: (fm: Record<string, unknown>) => Record<string, unknown>;
};

export class SkillsSection {
  readonly #params: SkillsSectionParams;

  constructor(params: SkillsSectionParams) {
    this.#params = params;
    if (!params.agentsSkillsDirectory && !params.directory) {
      throw new CapabilityConfigError(
        "SkillsSection requires either agentsSkillsDirectory or directory"
      );
    }
  }

  buildInstallPath(fileName: string): string | null {
    return this.#params.buildInstallPath(fileName);
  }

  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return this.#params.convertFrontmatter(fm);
  }

  serialize(frontmatter: Record<string, unknown>, body: string): string {
    return serializeFrontmatter(frontmatter, body);
  }
}
