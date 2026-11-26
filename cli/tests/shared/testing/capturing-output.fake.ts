import { describeMessage } from "../../../src/presentation/errors/describe-message.presenter.js";
import { OutputAdapter } from "../../../src/presentation/terminal/output.adapter.js";
import type { HintedMessage } from "../../../src/shared/domain/describe-error.js";

export type OutputLevel = "debug" | "info" | "warn" | "print" | "success" | "error";

export interface CapturedLine {
  readonly level: OutputLevel;
  readonly message: string;
}

/** What `exit` throws: a run that ends never returns, so a test sees it as a thrown code. */
export class ExitRequested extends Error {
  constructor(readonly code: number) {
    super(`exit ${String(code)}`);
  }
}

/** Extends the real output rather than standing in for it, so a widened double cannot stop
 * failing the day the class grows a method a display starts calling. */
export class CapturingOutput extends OutputAdapter {
  readonly captured: CapturedLine[] = [];

  constructor(verbose = false) {
    super(
      verbose,
      (code) => {
        throw new ExitRequested(code);
      },
      String,
      describeMessage
    );
  }

  /** Every message, in order, whatever its level. */
  get lines(): string[] {
    return this.captured.map((line) => line.message);
  }

  at(level: OutputLevel): string[] {
    return this.captured.filter((line) => line.level === level).map((line) => line.message);
  }

  override debug(message: string): void {
    this.captured.push({ level: "debug", message });
  }
  override info(message: string | HintedMessage): void {
    this.captured.push({ level: "info", message: describeMessage(message) });
  }
  override warn(message: string | HintedMessage): void {
    this.captured.push({ level: "warn", message: describeMessage(message) });
  }
  override print(message: string): void {
    this.captured.push({ level: "print", message });
  }
  override success(message: string): void {
    this.captured.push({ level: "success", message });
  }
  override error(message: string): void {
    this.captured.push({ level: "error", message });
  }
}
