import { ToolSuffix } from "./tool-suffix.js";

/** The suffix each AI tool marks its files with. Written here because a filter sits under the
 * profiles it filters for and cannot read their registration; conformance holds it equal to the
 * suffixes the registered AI profiles carry, so a tool added without its suffix fails there. */
export const TOOL_FILE_SUFFIXES: readonly string[] = [
  ".claude.md",
  ".cursor.md",
  ".copilot.md",
  ".opencode.md",
  ".kilo.md",
  ".codex.md",
  ".antigravity.md",
];

const ALL_TOOL_SUFFIXES: readonly ToolSuffix[] = TOOL_FILE_SUFFIXES.map(
  (suffix) => new ToolSuffix(suffix)
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
