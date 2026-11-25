import type { Prompter } from "../ports/prompter.js";

export interface ConfirmRemovalRequest {
  force: boolean;
  interactive?: boolean;
  question: string;
}

/** Whether a removal goes ahead: `--force` always, an interactive run when the person agrees,
 * anything else is a dry run. */
export class ConfirmRemoval {
  constructor(private readonly prompter?: Prompter) {}

  async execute(request: ConfirmRemovalRequest): Promise<boolean> {
    if (request.force) return true;
    if (request.interactive && this.prompter) return this.prompter.confirm(request.question);
    return false;
  }
}
