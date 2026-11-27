import type { EnsureFrameworkMarketplace } from "../../contexts/distribution/application/ensure-framework-marketplace.use-case.js";
import type { FrameworkSource } from "../../contexts/distribution/contract/framework-source.js";
import type { RecordSourceReference } from "../../contexts/machine-claims/application/shared-source/record-source-reference.use-case.js";
import type { Scope } from "../../shared/domain/scope.js";
import type { Environment } from "../../shared/ports/environment.js";
import type { RefreshMarketplaces } from "./refresh-marketplaces.use-case.js";

export interface RegisterMarketplaceRequest {
  projectRoot: string;
  scope?: Scope;
  /** The source a setup resolved, or `null` when it asked for none. */
  source: FrameworkSource | null;
}

export interface RegisterMarketplaceDeps {
  readonly ensure: EnsureFrameworkMarketplace;
  readonly recordReference: RecordSourceReference;
  readonly refresh: Pick<RefreshMarketplaces, "execute">;
  readonly environment: Environment;
}

/** The one sequence project-scope and machine-scope setup both run: register, then refresh the
 * catalog. The project's claim on the shared source comes back unrecorded, for the setup to record
 * once nothing it places refused. */
export class RegisterMarketplace {
  constructor(private readonly deps: RegisterMarketplaceDeps) {}

  async execute(command: RegisterMarketplaceRequest): Promise<(() => Promise<void>) | undefined> {
    const { projectRoot, source } = command;
    if (source === null) return undefined;
    const marketplace = await this.deps.ensure.execute({ projectRoot, source });
    if (this.deps.environment.get("AIDD_SKIP_MARKETPLACE_REFRESH") !== "1")
      await this.deps.refresh.execute({ projectRoot });
    // `--scope user` has no project-scope manifest for a later `clean` to ever decrement this
    // claim from, so absence, not a recorded reference, is the honest state there.
    if (command.scope === "user") return undefined;
    return () => this.deps.recordReference.execute({ projectRoot, marketplace });
  }
}
