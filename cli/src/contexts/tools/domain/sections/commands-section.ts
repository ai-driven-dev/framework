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
}
