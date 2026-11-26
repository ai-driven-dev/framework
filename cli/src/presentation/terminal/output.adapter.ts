import type { HintedMessage } from "../../shared/domain/describe-error.js";
import type { Output } from "./output.model.js";
export class OutputAdapter implements Output {
  private readonly verbose: boolean;

  /** `end` is how this process stops: the composition hands it in, so no presentation file exits.
   * `words` says a caught value, which only the entry point knows how to word; `describeMessage`
   * words a message and its hint. */
  constructor(
    verbose: boolean,
    private readonly end: (code: number) => never,
    private readonly words: (cause: unknown) => string,
    private readonly describeMessage: (message: string | HintedMessage) => string
  ) {
    this.verbose = verbose || process.env.AIDD_VERBOSE === "true";
  }

  debug(message: string, cause?: unknown): void {
    if (this.verbose) process.stderr.write(`[verbose] ${message}${this.tail(cause)}\n`);
  }

  info(message: string | HintedMessage): void {
    process.stdout.write(`${this.describeMessage(message)}\n`);
  }

  warn(message: string | HintedMessage, cause?: unknown): void {
    process.stderr.write(`Warning: ${this.describeMessage(message)}${this.tail(cause)}\n`);
  }

  print(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  success(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  private tail(cause: unknown): string {
    return cause === undefined ? "" : this.words(cause);
  }

  error(message: string): void {
    process.stderr.write(`Error: ${message}\n`);
  }

  exit(code: number): never {
    return this.end(code);
  }
}
