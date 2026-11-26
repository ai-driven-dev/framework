import type { FrameworkSource } from "../../contexts/distribution/contract/framework-source.js";
import type { SetupFlow } from "./setup-flow.model.js";

/** Settles which framework source a setup registers, asking when someone can answer. The question
 * is not the setup's own: composition hands it in. */
export type ResolveFrameworkSource = (options: {
  projectRoot: string;
  sourceFromCli?: FrameworkSource;
  interactive: boolean;
}) => Promise<FrameworkSource>;

/** Resolves `flow`'s framework source, when it asks for one at all. Called before a caller's own
 * manifest is initialized: a non-interactive run with no `--source` must reject before writing
 * anything. */
export class ResolveSetupSource {
  constructor(private readonly resolveSource: ResolveFrameworkSource) {}

  async execute(flow: SetupFlow): Promise<FrameworkSource | null> {
    if (!flow.registerDefaultMarketplace) return null;
    return this.resolveSource({
      projectRoot: flow.projectRoot,
      sourceFromCli: flow.source,
      interactive: flow.interactive,
    });
  }
}
