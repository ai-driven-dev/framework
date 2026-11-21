import { InputRequiredError } from "../../shared/domain/shared.error.js";
import type { Prompter } from "../../shared/ports/prompter.js";

export class SilentPrompterAdapter implements Prompter {
  async resolveConflict(
    _relativePath: string,
    _reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite"> {
    return "overwrite";
  }

  async resolveConflictBulk(
    _relativePath: string,
    _reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite" | "overwrite-all" | "skip-all"> {
    return "overwrite";
  }

  async confirm(_message: string, defaultValue?: boolean): Promise<boolean> {
    return defaultValue ?? true;
  }

  async input(_message: string, defaultValue?: string): Promise<string> {
    return defaultValue ?? "";
  }

  async select<T>(
    _message: string,
    choices: Array<{ name: string; value: T; disabled?: boolean | string }>
  ): Promise<T> {
    const first = choices.find((c) => !c.disabled);
    if (first === undefined) {
      throw new InputRequiredError("No enabled choices available");
    }
    return first.value;
  }

  async checkbox<T>(
    _message: string,
    choices: Array<{ name: string; value: T; checked?: boolean; disabled?: boolean | string }>
  ): Promise<T[]> {
    return choices.filter((c) => c.checked === true && !c.disabled).map((c) => c.value);
  }
}
