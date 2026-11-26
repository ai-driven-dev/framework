import { checkbox, confirm, input, select } from "@inquirer/prompts";
import type { Prompter } from "../../orchestration/ports/prompter.js";

type PromptContext = {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
};

export class InquirerPrompterAdapter implements Prompter {
  constructor(private readonly context?: PromptContext) {}

  private conflictMessage(relativePath: string, reason: "deleted" | "modified"): string {
    const description = reason === "deleted" ? "was deleted" : "was locally modified";
    return `Conflict: ${relativePath} ${description}. What do you want to do?`;
  }

  async resolveConflict(
    relativePath: string,
    reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite"> {
    return select(
      {
        message: this.conflictMessage(relativePath, reason),
        choices: [
          { name: "Overwrite with latest version", value: "overwrite" as const },
          { name: "Keep my local version", value: "keep" as const },
        ],
      },
      this.context
    );
  }

  async resolveConflictBulk(
    relativePath: string,
    reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite" | "overwrite-all" | "skip-all"> {
    return select(
      {
        message: this.conflictMessage(relativePath, reason),
        choices: [
          { name: "Overwrite with latest version", value: "overwrite" as const },
          { name: "Keep my local version", value: "keep" as const },
          { name: "Overwrite all remaining conflicts", value: "overwrite-all" as const },
          { name: "Skip all remaining conflicts", value: "skip-all" as const },
        ],
      },
      this.context
    );
  }

  async confirm(message: string, defaultValue?: boolean): Promise<boolean> {
    return confirm({ message, default: defaultValue ?? false }, this.context);
  }

  async input(message: string, defaultValue?: string): Promise<string> {
    return input({ message, default: defaultValue }, this.context);
  }

  async select<T>(
    message: string,
    choices: Array<{ name: string; value: T; disabled?: boolean | string; description?: string }>
  ): Promise<T> {
    return select(
      {
        message,
        choices: choices.map((c) => ({
          name: c.name,
          value: c.value,
          disabled: c.disabled === true ? "Disabled" : c.disabled || false,
          description: c.description,
        })),
      },
      this.context
    );
  }

  async checkbox<T>(
    message: string,
    choices: Array<{ name: string; value: T; checked?: boolean; disabled?: boolean | string }>
  ): Promise<T[]> {
    return checkbox(
      {
        message,
        choices: choices.map((c) => ({
          name: c.name,
          value: c.value,
          checked: c.checked,
          disabled: c.disabled,
        })),
      },
      this.context
    );
  }
}
