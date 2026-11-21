export interface Logger {
  /** `cause` is a caught value the writer words itself, after `message`. */
  debug(message: string, cause?: unknown): void;
  info(message: string): void;
  warn(message: string, cause?: unknown): void;
}
