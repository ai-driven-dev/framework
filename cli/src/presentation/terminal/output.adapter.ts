import type { Output } from "../../orchestration/domain/output.js";

export class OutputAdapter implements Output {
  private readonly verbose: boolean;

  /** `end` is how this process stops: the composition hands it in, so no presentation file exits. */
  constructor(
    verbose: boolean,
    private readonly end: (code: number) => never
  ) {
    this.verbose = verbose || process.env.AIDD_VERBOSE === "true";
  }

  debug(message: string): void {
    if (this.verbose) process.stderr.write(`[verbose] ${message}\n`);
  }

  info(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  warn(message: string): void {
    process.stderr.write(`Warning: ${message}\n`);
  }

  print(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  success(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  error(message: string): void {
    process.stderr.write(`Error: ${message}\n`);
  }

  exit(code: number): never {
    return this.end(code);
  }
}
