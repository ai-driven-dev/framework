import { serializeFrontmatter } from "../../../../shared/domain/markdown.js";
import { ForeignSuffixFilter } from "../profile/foreign-suffix-filter.js";

type CommandsSectionParams = {
  toolSuffix: string;
  buildInstallPath: (fileName: string) => string | null;
  convertFrontmatter: (
    fm: Record<string, unknown>,
    relativeFileName: string
  ) => Record<string, unknown>;
};

export class CommandsSection {
  readonly #params: CommandsSectionParams;

  constructor(params: CommandsSectionParams) {
    this.#params = params;
  }

  buildInstallPath(fileName: string): string | null {
    return this.#params.buildInstallPath(fileName);
  }

  convertFrontmatter(
    fm: Record<string, unknown>,
    relativeFileName: string
  ): Record<string, unknown> {
    return this.#params.convertFrontmatter(fm, relativeFileName);
  }

  acceptsFileName(fileName: string, registered: readonly string[]): boolean {
    return ForeignSuffixFilter.keeping(this.#params.toolSuffix, registered).accepts(fileName);
  }

  serialize(frontmatter: Record<string, unknown>, body: string): string {
    return serializeFrontmatter(frontmatter, body);
  }
}
