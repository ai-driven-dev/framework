import type { Logger } from "../../domain/ports/logger.js";

export class LoggerAdapter implements Logger {
  constructor(private readonly verbose: boolean = false) {}

  debug(message: string): void {
    if (this.verbose) {
      process.stderr.write(`${message}\n`);
    }
  }

  info(message: string): void {
    process.stderr.write(`${message}\n`);
  }

  warn(message: string): void {
    process.stderr.write(`[warn] ${message}\n`);
  }
}
