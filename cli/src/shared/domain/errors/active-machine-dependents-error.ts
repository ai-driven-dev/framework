import { AiddError } from "./aidd-error.js";

export class ActiveMachineDependentsError extends AiddError {
  readonly code = "active-machine-dependents";
  constructor(target: string, projects: readonly string[]) {
    super(`Cannot remove ${target}: active projects still depend on it: ${projects.join(", ")}.`);
    this.name = "ActiveMachineDependentsError";
  }
}
