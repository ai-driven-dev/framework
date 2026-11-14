import type { Environment } from "../../../shared/ports/environment.js";
import { type Binding, resolveBinding } from "../domain/declaration/binding-resolution.js";
import type { BranchRole } from "../domain/declaration/branch-role.js";
import { measurementRefused } from "../domain/telemetry-consent.js";
import type { SessionBindingStore } from "../ports/bindings/session-binding-store.js";
import type { PersonIdentityStore } from "../ports/identity/person-identity-store.js";
import type { BranchDeclarations } from "./branch-declarations.js";
import type { ConsentedRepositories, RefusalReason } from "./consented-repositories.js";

export interface ReadTelemetryStatusCommand {
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

export interface StatusOptions {
  readonly environment: Environment;
  readonly sessionId: string | null;
  readonly now: () => Date;
}

/** What the work being done now is bound to, and where that comes from. Reads only. */
export class ReadTelemetryStatus {
  constructor(
    private readonly repositories: ConsentedRepositories,
    private readonly sessions: SessionBindingStore,
    private readonly branches: BranchDeclarations,
    private readonly options: StatusOptions,
    private readonly identities: PersonIdentityStore
  ) {}

  async execute({ cwd }: ReadTelemetryStatusCommand): Promise<ReadTelemetryStatusResult> {
    if (measurementRefused(this.options.environment))
      return { status: "refused", reason: "environment" };
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
      since: repository.since,
      sessionId: this.options.sessionId,
      branch: current.name,
      role: current.role,
      binding,
      personId: await this.identities.read(),
    };
  }
}
