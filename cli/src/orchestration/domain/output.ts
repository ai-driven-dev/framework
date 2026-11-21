/** Where a command's result and its failure go, and how the run ends. It speaks the logger's
 * levels too, so the one terminal writer serves both. */
export interface Output {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  print(message: string): void;
  success(message: string): void;
  error(message: string): void;
  /** Ends the run with this exit code. */
  exit(code: number): never;
}
