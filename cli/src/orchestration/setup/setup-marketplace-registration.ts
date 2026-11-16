import type { FrameworkSource } from "../../contexts/distribution/contract/framework-source.js";
import type { SetupFlow } from "./setup-flow.js";

/** Registers the chosen framework source for a setup. The registration sequence is not the setup's own:
 * composition hands it in. */
export type RegisterFrameworkSource = (
  flow: Pick<SetupFlow, "projectRoot" | "scope">,
  source: FrameworkSource | null
) => Promise<void>;

/** Settles which framework source a setup registers, asking when someone can answer. The question
 * is not the setup's own: composition hands it in. */
export type ResolveFrameworkSource = (options: {
  projectRoot: string;
  sourceFromCli?: FrameworkSource;
  interactive: boolean;
}) => Promise<FrameworkSource>;

/** What project-scope and machine-scope setup ask of the marketplace: which source to register,
 * then registering it. */
export class SetupMarketplaceRegistration {
  constructor(
    private readonly resolveSource: ResolveFrameworkSource,
    private readonly register: RegisterFrameworkSource
  ) {}

  /** Resolves `flow`'s source, when it asks for one at all. Called before a caller's own manifest
   * is initialized: a non-interactive run with no `--source` must reject before writing anything. */
  async resolveSourceIfNeeded(flow: SetupFlow): Promise<FrameworkSource | null> {
    if (!flow.registerDefaultMarketplace) return null;
    return this.resolveSource({
      projectRoot: flow.projectRoot,
      sourceFromCli: flow.source,
      interactive: flow.interactive,
    });
  }

  /** Registers the source `resolveSourceIfNeeded` returned, once the caller's own manifest
   * exists. A no-op when there was no source to register. */
  async registerIfPresent(flow: SetupFlow, source: FrameworkSource | null): Promise<void> {
    await this.register(flow, source);
  }
}
