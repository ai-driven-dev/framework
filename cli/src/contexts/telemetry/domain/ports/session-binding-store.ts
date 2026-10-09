import type {
  SessionCarry,
  SessionDeclaration,
  TaskDeclaration,
} from "../declaration/task-declaration.js";

/** The declarations a person made in their sessions, and the carries across a `/clear`, kept
 * in the person's own telemetry directory. */
export interface SessionBindingStore {
  /** Appended, never rewritten: each declaration keeps its own time. */
  append(sessionId: string, declaration: TaskDeclaration): Promise<void>;
  declarations(): Promise<readonly SessionDeclaration[]>;
  carries(): Promise<readonly SessionCarry[]>;
}
