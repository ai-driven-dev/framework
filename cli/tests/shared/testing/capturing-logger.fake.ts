import { describeMessage } from "../../../src/presentation/errors/describe-message.presenter.js";
import { render } from "../../../src/presentation/errors/error-translator.presenter.js";
import type { HintedMessage } from "../../../src/shared/domain/describe-error.js";
import type { Logger } from "../../../src/shared/ports/logger.js";

export class CapturingLogger implements Logger {
  readonly debugMessages: string[] = [];
  readonly infoMessages: string[] = [];
  readonly warnMessages: string[] = [];

  debug(message: string, cause?: unknown): void {
    this.debugMessages.push(cause === undefined ? message : message + render(cause));
  }

  info(message: string | HintedMessage): void {
    this.infoMessages.push(describeMessage(message));
  }

  warn(message: string | HintedMessage, cause?: unknown): void {
    const words = describeMessage(message);
    this.warnMessages.push(cause === undefined ? words : words + render(cause));
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
