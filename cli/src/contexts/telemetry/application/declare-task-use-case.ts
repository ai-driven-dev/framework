import type { TaskDeclaration } from "../domain/declaration/task-declaration.js";
import {
  type DeclarationRequest,
  type DeclaredBy,
  declarationOf,
} from "../domain/declaration/task-declaration.js";
import type { BindingsLock } from "../domain/ports/bindings/bindings-lock.js";
import type { SessionBindingStore } from "../domain/ports/bindings/session-binding-store.js";
import type { BranchDeclarations, BranchOutcome } from "./branch-declarations.js";
import type { ConsentedRepositories, RefusalReason } from "./consented-repositories.js";

export interface DeclareInput {
  readonly cwd: string;
  readonly request: DeclarationRequest;
  readonly by: DeclaredBy;
}

export type DeclareResult =
  | { readonly status: "refused"; readonly reason: RefusalReason }
  | {
      readonly status: "declared";
      readonly declaration: TaskDeclaration;
      /** The session the declaration applies to from now, `null` outside a session. */
      readonly sessionId: string | null;
      readonly branch: BranchOutcome;
    };

export interface DeclareOptions {
  /** `AIDD_TELEMETRY=0`, read by the composition root. */
  readonly refusedByEnvironment: boolean;
  /** `CLAUDE_CODE_SESSION_ID`, read by the composition root; `null` outside a session. */
  readonly sessionId: string | null;
  readonly now: () => Date;
}

/** Binds what a person works on to a task: the running session from now on, and the working
 * branch for good. The session line is appended under the bindings lock, and the snapshot that
 * follows a branch declaration takes it for itself: never the ledger's lock, which an ingest
 * holds for as long as it reads, and a person is waiting on this. */
export class DeclareTaskUseCase {
  constructor(
    private readonly repositories: ConsentedRepositories,
    private readonly sessions: SessionBindingStore,
    private readonly branches: BranchDeclarations,
    private readonly lock: BindingsLock,
    private readonly options: DeclareOptions
  ) {}

  async execute(input: DeclareInput): Promise<DeclareResult> {
    if (this.options.refusedByEnvironment) return { status: "refused", reason: "environment" };
    const repository = await this.repositories.open(input.cwd);
    if (repository.status === "refused") return repository;
    const declaration = declarationOf(input.request, this.options.now(), input.by);
    const { sessionId } = this.options;
    if (sessionId !== null) {
      await this.lock.exclusively(() => this.sessions.append(sessionId, declaration));
    }
    const branch = await this.branches.declare(
      repository.repositoryId,
      repository.root,
      declaration
    );
    return { status: "declared", declaration, sessionId, branch };
  }
}
