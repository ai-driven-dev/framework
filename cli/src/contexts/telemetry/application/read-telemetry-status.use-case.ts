import type { BranchConfigBinding } from "../domain/branch-binding.js";
import { type Binding, resolveBinding } from "../domain/declaration/binding-resolution.js";
import type { BranchRole } from "../domain/declaration/branch-role.js";
import type { SessionBindingStore } from "../ports/bindings/session-binding-store.js";
import type { PersonIdentityStore } from "../ports/identity/person-identity-store.js";
import type { ReadCurrentBranch } from "./declaration/read-current-branch.use-case.js";
import type {
  FindConsentedRepository,
  RefusalReason,
} from "./find-consented-repository.use-case.js";

export interface ReadTelemetryStatusRequest {
  readonly cwd: string;
}

export type ReadTelemetryStatusResult =
  | { readonly status: "refused"; readonly reason: RefusalReason }
  | {
      readonly status: "shown";
      /** When this clone's measurement began. */
      readonly since: string;
      readonly sessionId: string | null;
      readonly branch: string | null;
      readonly role: BranchRole;
      readonly binding: Binding;
      /** Who the measurement names, `null` for nobody. */
      readonly personId: string | null;
    };

/** What the running session's work is bound to, given the task its branch declares. */
export type CurrentBinding = (branch: BranchConfigBinding | null) => Promise<Binding>;

/** Resolves a binding at the moment it is asked, over the session's declarations and carries. */
export function currentBindingOf(deps: {
  readonly sessions: SessionBindingStore;
  readonly sessionId: string | null;
  readonly now: () => Date;
}): CurrentBinding {
  return async (branch) =>
    resolveBinding({
      sessionId: deps.sessionId,
      at: deps.now(),
      declarations: await deps.sessions.declarations(),
      carries: await deps.sessions.carries(),
      branch,
    });
}

interface ReadTelemetryStatusDeps {
  readonly repositories: FindConsentedRepository;
  readonly bindingOf: CurrentBinding;
  readonly branches: ReadCurrentBranch;
  readonly sessionId: string | null;
  readonly identities: PersonIdentityStore;
}

/** What the work being done now is bound to, and where that comes from. Reads only. */
export class ReadTelemetryStatus {
  constructor(private readonly deps: ReadTelemetryStatusDeps) {}

  async execute({ cwd }: ReadTelemetryStatusRequest): Promise<ReadTelemetryStatusResult> {
    const repository = await this.deps.repositories.execute(cwd);
    if (repository.status === "refused") return repository;
    const current = await this.deps.branches.execute(repository.root);
    const binding = await this.deps.bindingOf(current.declared);
    return {
      status: "shown",
      since: repository.since,
      sessionId: this.deps.sessionId,
      branch: current.name,
      role: current.role,
      binding,
      personId: await this.deps.identities.read(),
    };
  }
}
