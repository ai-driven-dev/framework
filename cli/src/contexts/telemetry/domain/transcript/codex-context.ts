import { text } from "../read-back.js";
import type { Json } from "./line-values.js";

/** What the lines of a file before a call say about it: the file's first `session_meta` and
 * its latest `turn_context`. */
export class CodexContext {
  constructor(
    readonly session: Json | null = null,
    readonly turn: Json | null = null
  ) {}

  get cwd(): string | null {
    return text(this.turn?.cwd) ?? text(this.session?.cwd);
  }
}
