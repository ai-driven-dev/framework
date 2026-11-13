import { join } from "node:path";
import { readTextIfPresent } from "../../../../kernel/reading/text-file.js";
import {
  parseSessionCarry,
  parseSessionDeclaration,
  renderSessionDeclaration,
  type SessionCarry,
  type SessionDeclaration,
  type TaskDeclaration,
} from "../../domain/declaration/task-declaration.js";
import type { SessionBindingStore } from "../../domain/ports/bindings/session-binding-store.js";
import type { PrivateStorage } from "../../domain/ports/private-storage.js";

/** `sessions.jsonl` and `carries.jsonl` under the bindings directory: append-only, one line
 * each. A line that is not exactly one of them is skipped, never guessed at. */
export class SessionBindingStoreAdapter implements SessionBindingStore {
  constructor(
    private readonly dir: string,
    private readonly storage: PrivateStorage
  ) {}

  async append(sessionId: string, declaration: TaskDeclaration): Promise<void> {
    await this.storage.ensureDirectory(this.dir);
    await this.storage.append(
      join(this.dir, "sessions.jsonl"),
      `${renderSessionDeclaration(sessionId, declaration)}\n`
    );
  }

  async declarations(): Promise<readonly SessionDeclaration[]> {
    return this.lines("sessions.jsonl", parseSessionDeclaration);
  }

  async carries(): Promise<readonly SessionCarry[]> {
    return this.lines("carries.jsonl", parseSessionCarry);
  }

  private async lines<T>(file: string, parse: (line: string) => T | null): Promise<T[]> {
    const text = (await readTextIfPresent(join(this.dir, file))) ?? "";
    return text
      .split("\n")
      .map(parse)
      .filter((entry): entry is T => entry !== null);
  }
}
