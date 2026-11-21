import { describeCause } from "../../../src/presentation/errors/error-translator.presenter.js";
import type { Logger } from "../../../src/shared/ports/logger.js";

export class CapturingLogger implements Logger {
  readonly debugMessages: string[] = [];
  readonly infoMessages: string[] = [];
  readonly warnMessages: string[] = [];

  debug(message: string): void {
    this.debugMessages.push(message);
  }

  info(message: string): void {
    this.infoMessages.push(message);
  }

  warn(message: string, cause?: unknown): void {
    this.warnMessages.push(cause === undefined ? message : message + describeCause(cause));
  }

  get allMessages(): string[] {
    return [...this.debugMessages, ...this.infoMessages, ...this.warnMessages];
  }

  reset(): void {
    this.debugMessages.length = 0;
    this.infoMessages.length = 0;
    this.warnMessages.length = 0;
  }
}
