import type { Environment } from "../../../../shared/ports/environment.js";
import type { DeclarationRequest, DeclaredBy } from "../../contract/task-declaration.js";
import type { TaskDeclaration } from "../../domain/declaration/task-declaration.js";
import { declarationOf, lockWaitFor } from "../../domain/declaration/task-declaration.js";
import { measurementRefused } from "../../domain/telemetry-consent.js";
import type { BindingsLock } from "../../ports/bindings/bindings-lock.js";
import type { SessionBindingStore } from "../../ports/bindings/session-binding-store.js";
import type { BranchDeclarations, BranchOutcome } from "../branch-declarations.js";
import type { ConsentedRepositories, RefusalReason } from "../consented-repositories.js";

export interface DeclareTaskCommand {
  readonly cwd: string;
  readonly request: DeclarationRequest;
  readonly by: DeclaredBy;
}

export type DeclareTaskResult =
  | { readonly status: "refused"; readonly reason: RefusalReason }
  | {
      readonly status: "declared";
      readonly declaration: TaskDeclaration;
      /** The session the declaration applies to from now, `null` outside a session. */
      readonly sessionId: string | null;
      readonly branch: BranchOutcome;
    };

export interface DeclareOptions {
  readonly environment: Environment;
  /** `AIDD_TELEMETRY_SESSION_ID`, else `CLAUDE_CODE_SESSION_ID`, read by the composition root;
   * `null` outside a session. */
  readonly sessionId: string | null;
  readonly now: () => Date;
}

/** Binds what a person works on to a task: the running session from now on, and the working
 * branch for good. The session line is appended under the bindings lock, and the snapshot that
 * follows a branch declaration takes it for itself: never the ledger's lock, which an ingest
 * holds for as long as it reads, and a person is waiting on this. */
export class DeclareTask {
  constructor(
    private readonly repositories: ConsentedRepositories,
    private readonly sessions: SessionBindingStore,
    private readonly branches: BranchDeclarations,
    private readonly lock: BindingsLock,
    private readonly options: DeclareOptions
  ) {}

  async execute(input: DeclareTaskCommand): Promise<DeclareTaskResult> {
    if (measurementRefused(this.options.environment))
      return { status: "refused", reason: "environment" };
    const repository = await this.repositories.open(input.cwd);
    if (repository.status === "refused") return repository;
    const declaration = declarationOf(input.request, this.options.now(), input.by);
    const { sessionId } = this.options;
    if (sessionId !== null) {
      await this.lock.exclusively(
        () => this.sessions.append(sessionId, declaration),
        lockWaitFor(declaration.by)
      );
    }
    const branch = await this.branches.declare(
      repository.repositoryId,
      repository.root,
      declaration
    );
    return { status: "declared", declaration, sessionId, branch };
  }
}
