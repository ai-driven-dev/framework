import type {
  SessionCarry,
  SessionDeclaration,
  TaskDeclaration,
} from "../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import type { SessionBindingStore } from "../../../../src/contexts/telemetry/ports/bindings/session-binding-store.js";

export class InMemorySessions implements SessionBindingStore {
  readonly lines: SessionDeclaration[] = [];
  readonly carried: SessionCarry[] = [];

  constructor(readonly events: string[] = []) {}

  async append(sessionId: string, declaration: TaskDeclaration): Promise<void> {
    this.events.push("append");
    this.lines.push({ session_id: sessionId, ...declaration });
  }

  async declarations(): Promise<readonly SessionDeclaration[]> {
    return [...this.lines];
  }

  async carries(): Promise<readonly SessionCarry[]> {
    return [...this.carried];
  }
}
