import { select } from "@inquirer/prompts";
import type { Prompter } from "../../domain/ports/prompter.js";

export class SilentPrompterAdapter implements Prompter {
  async resolveConflict(
    _relativePath: string,
    _reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite"> {
    return "overwrite";
  }
}

export class InquirerPrompterAdapter implements Prompter {
  async resolveConflict(
    relativePath: string,
    reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite"> {
    const description = reason === "deleted" ? "was deleted" : "was locally modified";
    return select({
      message: `Conflict: ${relativePath} ${description}. What do you want to do?`,
      choices: [
        { name: "Overwrite with latest version", value: "overwrite" as const },
        { name: "Keep my local version", value: "keep" as const },
      ],
    });
  }
}
