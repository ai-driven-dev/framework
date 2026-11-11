import { serializeFrontmatter } from "../../../../kernel/markdown.js";
import { ForeignSuffixFilter } from "../profile/foreign-suffix-filter.js";

export class CommandsCapability {
  private readonly foreignSuffixes: ForeignSuffixFilter;

  constructor(
    readonly params: {
      directory: string;
      toolSuffix: string;
      buildInstallPath: (fileName: string) => string | null;
      convertFrontmatter: (
        fm: Record<string, unknown>,
        relativeFileName: string
      ) => Record<string, unknown>;
    }
  ) {
    this.foreignSuffixes = ForeignSuffixFilter.keeping(params.toolSuffix);
  }

  buildOutputPath(commandName: string): string {
    return `${this.params.directory}commands/${commandName}${this.params.toolSuffix}`;
  }

  buildInstallPath(fileName: string): string | null {
    return this.params.buildInstallPath(fileName);
  }

  convertFrontmatter(
    fm: Record<string, unknown>,
    relativeFileName: string
  ): Record<string, unknown> {
    return this.params.convertFrontmatter(fm, relativeFileName);
  }

  acceptsFileName(fileName: string): boolean {
    return this.foreignSuffixes.accepts(fileName);
  }

  serialize(frontmatter: Record<string, unknown>, body: string): string {
    return serializeFrontmatter(frontmatter, body);
  }

  accepts(relativePath: string): boolean {
    return relativePath.startsWith(this.params.directory);
  }

  equals(other: CommandsCapability): boolean {
    return (
      this.params.directory === other.params.directory &&
      this.params.toolSuffix === other.params.toolSuffix
    );
  }
}
