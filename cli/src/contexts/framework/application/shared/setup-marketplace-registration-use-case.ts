import type { FrameworkSource } from "../../../distribution/contract/framework-source.js";
import type { MarketplaceSourceMode } from "../../../distribution/domain/marketplace-source-mode.js";
import type { SetupFlow } from "../../domain/setup-flow.js";
import type { SetupMarketplaceSourceUseCase } from "../setup/setup-marketplace-source-use-case.js";

/** Registers the chosen framework source for a setup. The registration sequence is not framework's:
 * composition hands it in. */
export type RegisterFrameworkSource = (
  flow: Pick<SetupFlow, "projectRoot" | "scope">,
  source: FrameworkSource | null
) => Promise<void>;

/** What project-scope and machine-scope setup ask of the marketplace: which source to register,
 * then registering it. */
export class SetupMarketplaceRegistrationUseCase {
  constructor(
    private readonly setupMarketplaceSourceUseCase: SetupMarketplaceSourceUseCase,
    private readonly register: RegisterFrameworkSource
  ) {}

  /** Resolves `flow`'s source, when it asks for one at all. Called before a caller's own manifest
   * is initialized: a non-interactive run with no `--source` must reject before writing anything. */
  async resolveSourceIfNeeded(flow: SetupFlow): Promise<MarketplaceSourceMode | null> {
    if (!flow.registerDefaultMarketplace) return null;
    return this.setupMarketplaceSourceUseCase.execute({
      projectRoot: flow.projectRoot,
      sourceFromCli: flow.source,
      interactive: flow.interactive,
    });
  }

  /** Registers the source `resolveSourceIfNeeded` returned, once the caller's own manifest
   * exists. A no-op when there was no source to register. */
  async registerIfPresent(flow: SetupFlow, source: MarketplaceSourceMode | null): Promise<void> {
    await this.register(flow, source);
  }
}
