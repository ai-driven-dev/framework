import type { HintedMessage } from "../domain/describe-error.js";

export interface Logger {
  /** `cause` is a caught value the writer words itself, after `message`. */
  debug(message: string | HintedMessage, cause?: unknown): void;
  info(message: string | HintedMessage): void;
  warn(message: string | HintedMessage, cause?: unknown): void;
}
