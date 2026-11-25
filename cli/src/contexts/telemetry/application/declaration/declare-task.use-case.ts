import type {
  DeclarationRequest,
  TaskDeclaration,
} from "../../domain/declaration/task-declaration.js";
import { declarationOf } from "../../domain/declaration/task-declaration.js";
import type { BindingsLock } from "../../ports/bindings/bindings-lock.js";
import type { SessionBindingStore } from "../../ports/bindings/session-binding-store.js";
import type {
  FindConsentedRepository,
  RefusalReason,
} from "../find-consented-repository.use-case.js";
import type { DeclareOnBranch, DeclareOnBranchResult } from "./declare-on-branch.use-case.js";

export interface DeclareTaskRequest {
  readonly cwd: string;
  readonly request: DeclarationRequest;
}

export type DeclareTaskResult =
  | { readonly status: "refused"; readonly reason: RefusalReason }
  | {
      readonly status: "declared";
      readonly declaration: TaskDeclaration;
      /** The session the declaration applies to from now, `null` outside a session. */
      readonly sessionId: string | null;
      readonly branch: DeclareOnBranchResult;
    };

/** Appends a declaration to the running session's bindings. */
export type BindSession = (sessionId: string, declaration: TaskDeclaration) => Promise<void>;

/** The session line appended under the bindings lock. */
export function sessionBindingOf(sessions: SessionBindingStore, lock: BindingsLock): BindSession {
  return (sessionId, declaration) =>
    lock.exclusively(() => sessions.append(sessionId, declaration));
}

interface DeclareTaskDeps {
  readonly repositories: FindConsentedRepository;
  readonly bindSession: BindSession;
  readonly branches: DeclareOnBranch;
  /** `CLAUDE_CODE_SESSION_ID`, read by the composition root; `null` outside a session. */
  readonly sessionId: string | null;
  readonly now: () => Date;
}

/** Binds what a person works on to a task: the running session from now on, and the working
 * branch for good. The session line is appended under the bindings lock, and the snapshot that
 * follows a branch declaration takes it for itself: never the ledger's lock, which an ingest
 * holds for as long as it reads, and a person is waiting on this. */
export class DeclareTask {
  constructor(private readonly deps: DeclareTaskDeps) {}

  async execute(input: DeclareTaskRequest): Promise<DeclareTaskResult> {
    const repository = await this.deps.repositories.execute(input.cwd);
    if (repository.status === "refused") return repository;
    const declaration = declarationOf(input.request, this.deps.now(), "command");
    const { sessionId } = this.deps;
    if (sessionId !== null) await this.deps.bindSession(sessionId, declaration);
    const branch = await this.deps.branches.execute({
      repositoryId: repository.repositoryId,
      root: repository.root,
      declaration,
    });
    return { status: "declared", declaration, sessionId, branch };
  }
}
