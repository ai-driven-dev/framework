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
  readonly #foreignSuffixes: ForeignSuffixFilter;

  constructor(params: CommandsSectionParams) {
    this.#params = params;
    this.#foreignSuffixes = ForeignSuffixFilter.keeping(params.toolSuffix);
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

  acceptsFileName(fileName: string): boolean {
    return this.#foreignSuffixes.accepts(fileName);
  }

  serialize(frontmatter: Record<string, unknown>, body: string): string {
    return serializeFrontmatter(frontmatter, body);
  }
}
