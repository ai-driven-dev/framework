import { AI_TOOL_IDS } from "../../../../kernel/tool.js";
import { ToolSuffix } from "./tool-suffix.js";

const ALL_TOOL_SUFFIXES: readonly ToolSuffix[] = AI_TOOL_IDS.map(
  (id) => new ToolSuffix(`.${id}.md`)
);

/** Keeps a reader from installing a file written for another tool. */
export class ForeignSuffixFilter {
  private constructor(private readonly foreign: readonly ToolSuffix[]) {}

  /** A filter for the reader whose own suffix is `own`, possibly none. */
  static keeping(own?: string): ForeignSuffixFilter {
    return new ForeignSuffixFilter(ALL_TOOL_SUFFIXES.filter((suffix) => suffix.value !== own));
  }

  accepts(fileName: string): boolean {
    return !this.foreign.some((suffix) => suffix.isForeign(fileName));
  }
}
