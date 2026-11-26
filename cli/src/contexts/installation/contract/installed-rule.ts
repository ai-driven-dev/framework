import type { AiToolId } from "../../../shared/domain/tool.js";

/** One rule as it sits installed in a project, read back rather than generated. */
export interface InstalledRule {
  readonly tool: AiToolId;
  /** Project-relative, `/`-separated, exactly as the scan found it. */
  readonly path: string;
  /** The file's own name with the installed extension removed: never a frontmatter field. A
   * rule's identity is where it sits: two rules may state the same `name` and still be two. */
  readonly name: string;
  /** What the rule says it governs, empty where it says nothing. Empty rather than absent: a
   * missing description is a rule that stated none, not a tool that cannot carry one. */
  readonly description: string;
  /** Every glob the rule scopes itself to, absent when it names none: which means it
   * applies everywhere, a different statement from an empty list. */
  readonly paths?: readonly string[];
}
