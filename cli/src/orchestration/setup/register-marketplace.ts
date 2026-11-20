import type { EnsureFrameworkMarketplace } from "../../contexts/distribution/application/ensure-framework-marketplace.js";
import type { RefreshMarketplace } from "../../contexts/distribution/application/refresh-marketplace.js";
import type { FrameworkSource } from "../../contexts/distribution/contract/framework-source.js";
import type { RecordSourceReference } from "../../contexts/machine-claims/application/record-source-reference.js";
import type { Scope } from "../../shared/domain/scope.js";
import type { Environment } from "../../shared/ports/environment.js";

export interface RegisterMarketplaceCommand {
  projectRoot: string;
  scope?: Scope;
  /** The source a setup resolved, or `null` when it asked for none. */
  source: FrameworkSource | null;
}

/** The one sequence project-scope and machine-scope setup both run, in the same order: register,
 * record the project's claim on the shared source, refresh the catalog. */
export class RegisterMarketplace {
  constructor(
    private readonly ensure: EnsureFrameworkMarketplace,
    private readonly recordReference: RecordSourceReference,
    private readonly refresh: Pick<RefreshMarketplace, "execute">,
    private readonly environment: Environment
  ) {}

  async execute(command: RegisterMarketplaceCommand): Promise<void> {
    const { projectRoot, source } = command;
    if (source === null) return;
    const marketplace = await this.ensure.execute({ projectRoot, source });
    // `--scope user` has no project-scope manifest for a later `clean` to ever decrement this
    // claim from, so absence, not a recorded reference, is the honest state there.
    if (command.scope !== "user") await this.recordReference.execute({ projectRoot, marketplace });
    if (this.environment.get("AIDD_SKIP_MARKETPLACE_REFRESH") === "1") return;
    await this.refresh.execute({ projectRoot });
  }
}
