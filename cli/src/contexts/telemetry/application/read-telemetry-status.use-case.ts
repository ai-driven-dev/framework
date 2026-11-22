import type { Environment } from "../../../shared/ports/environment.js";
import { type Binding, resolveBinding } from "../domain/declaration/binding-resolution.js";
import type { BranchRole } from "../domain/declaration/branch-role.js";
import { MEASUREMENT_SWITCH, measurementRefused } from "../domain/telemetry-consent.js";
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

export interface ReadTelemetryStatusOptions {
  readonly environment: Environment;
  readonly sessionId: string | null;
  readonly now: () => Date;
}

interface ReadTelemetryStatusDeps {
  readonly repositories: FindConsentedRepository;
  readonly sessions: SessionBindingStore;
  readonly branches: ReadCurrentBranch;
  readonly options: ReadTelemetryStatusOptions;
  readonly identities: PersonIdentityStore;
}

/** What the work being done now is bound to, and where that comes from. Reads only. */
export class ReadTelemetryStatus {
  constructor(private readonly deps: ReadTelemetryStatusDeps) {}

  async execute({ cwd }: ReadTelemetryStatusRequest): Promise<ReadTelemetryStatusResult> {
    if (measurementRefused(this.deps.options.environment.get(MEASUREMENT_SWITCH)))
      return { status: "refused", reason: "environment" };
    const repository = await this.deps.repositories.execute(cwd);
    if (repository.status === "refused") return repository;
    const current = await this.deps.branches.execute(repository.root);
    const binding = resolveBinding({
      sessionId: this.deps.options.sessionId,
      at: this.deps.options.now(),
      declarations: await this.deps.sessions.declarations(),
      carries: await this.deps.sessions.carries(),
      branch: current.declared,
    });
    return {
      status: "shown",
      since: repository.since,
      sessionId: this.deps.options.sessionId,
      branch: current.name,
      role: current.role,
      binding,
      personId: await this.deps.identities.read(),
    };
  }
}
