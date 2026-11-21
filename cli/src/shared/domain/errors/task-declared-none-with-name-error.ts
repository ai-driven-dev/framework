import { AiddError } from "./aidd-error.js";

/** `aidd telemetry task --none` given a name or a ticket. */
export class TaskDeclaredNoneWithNameError extends AiddError {
  readonly code = "task-declared-none-with-name";
  constructor() {
    super("--none declares no task: give it neither a name nor --ticket.");
    this.name = "TaskDeclaredNoneWithNameError";
  }
}
