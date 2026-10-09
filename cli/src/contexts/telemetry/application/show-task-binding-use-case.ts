import { type Binding, resolveBinding } from "../domain/declaration/binding-resolution.js";
import type { BranchRole } from "../domain/declaration/branch-role.js";
import type { SessionBindingStore } from "../domain/ports/session-binding-store.js";
import type { BranchDeclarations } from "./branch-declarations.js";
import type { ConsentedRepositories, RefusalReason } from "./consented-repositories.js";

export type ShowResult =
  | { readonly status: "refused"; readonly reason: RefusalReason }
  | {
      readonly status: "shown";
      readonly sessionId: string | null;
      readonly branch: string | null;
      readonly role: BranchRole;
      readonly binding: Binding;
    };

export interface ShowOptions {
  readonly refusedByEnvironment: boolean;
  readonly sessionId: string | null;
  readonly now: () => Date;
}

/** What the work being done now is bound to, and where that comes from. Reads only. */
export class ShowTaskBindingUseCase {
  constructor(
    private readonly repositories: ConsentedRepositories,
    private readonly sessions: SessionBindingStore,
    private readonly branches: BranchDeclarations,
    private readonly options: ShowOptions
  ) {}

  async execute(cwd: string): Promise<ShowResult> {
    if (this.options.refusedByEnvironment) return { status: "refused", reason: "environment" };
    const repository = await this.repositories.open(cwd);
    if (repository.status === "refused") return repository;
    const current = await this.branches.current(repository.root);
    const binding = resolveBinding({
      sessionId: this.options.sessionId,
      at: this.options.now(),
      declarations: await this.sessions.declarations(),
      carries: await this.sessions.carries(),
      branch: current.declared,
    });
    return {
      status: "shown",
      sessionId: this.options.sessionId,
      branch: current.name,
      role: current.role,
      binding,
    };
  }
}
