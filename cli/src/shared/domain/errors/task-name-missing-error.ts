import { AiddError } from "./aidd-error.js";

/** `aidd telemetry task` given neither a name nor `--none`. */
export class TaskNameMissingError extends AiddError {
  readonly code = "task-name-missing";
  constructor() {
    super(
      "A task needs a name: aidd telemetry task <name> [--ticket <ref>], or --none. See what the work is bound to with aidd telemetry status."
    );
    this.name = "TaskNameMissingError";
  }
}
