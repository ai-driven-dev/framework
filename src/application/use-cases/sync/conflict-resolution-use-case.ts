import type { ConflictDecision } from "../../../domain/models/merge.js";
import type { Prompter } from "../../../domain/ports/prompter.js";

export class ConflictResolutionUseCase {
  constructor(private readonly prompter: Prompter) {}

  async execute(relativePaths: string[]): Promise<Map<string, ConflictDecision>> {
    const result = new Map<string, ConflictDecision>();

    if (relativePaths.length === 0) {
      return result;
    }

    const mode = await this.prompter.select<"global" | "one-by-one">(
      "How do you want to handle conflicts?",
      [
        { name: "Handle globally", value: "global" },
        { name: "Handle one by one", value: "one-by-one" },
      ]
    );

    if (mode === "global") {
      const globalAction = await this.prompter.select<"overwrite all" | "skip all" | "backup all">(
        "Apply to all conflicts:",
        [
          { name: "Overwrite all", value: "overwrite all" },
          { name: "Skip all", value: "skip all" },
          { name: "Backup all", value: "backup all" },
        ]
      );

      for (const relativePath of relativePaths) {
        if (globalAction === "overwrite all") {
          result.set(relativePath, "overwrite");
        } else if (globalAction === "skip all") {
          result.set(relativePath, "skip");
        } else {
          result.set(relativePath, "backup");
        }
      }
    } else {
      for (const relativePath of relativePaths) {
        const action = await this.prompter.select<ConflictDecision>(relativePath, [
          { name: "Overwrite with latest version", value: "overwrite" },
          { name: "Skip (keep my version)", value: "skip" },
          { name: "Backup and overwrite", value: "backup" },
        ]);

        result.set(relativePath, action);
      }
    }

    return result;
  }
}
