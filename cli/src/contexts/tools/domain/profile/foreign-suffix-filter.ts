import { ToolSuffix } from "./tool-suffix.js";

/** Keeps a reader from installing a file written for another tool. */
export class ForeignSuffixFilter {
  private constructor(private readonly foreign: readonly ToolSuffix[]) {}

  /** A filter for the reader whose own suffix is `own`, possibly none, over the suffixes the
   * registered tools carry. */
  static keeping(own: string | undefined, registered: readonly string[]): ForeignSuffixFilter {
    return new ForeignSuffixFilter(
      registered.filter((suffix) => suffix !== own).map((suffix) => new ToolSuffix(suffix))
    );
  }

  accepts(fileName: string): boolean {
    return !this.foreign.some((suffix) => suffix.isForeign(fileName));
  }
}
