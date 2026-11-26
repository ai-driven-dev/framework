import type {
  InstallTools,
  InstallToolsResult,
} from "../../../contexts/installation/application/install/install-tools.use-case.js";
import type { ProjectContext } from "../../../contexts/installation/contract/project-context.js";
import type { SetupFlow } from "../setup-flow.model.js";
import type { ChooseTools } from "./choose-tools.use-case.js";

export interface InstallSetupToolsRequest {
  readonly flow: SetupFlow;
  readonly context: ProjectContext | undefined;
}

/** Installs the tools a setup is for: the ones its flow names, or the ones the person picks. */
export class InstallSetupTools {
  constructor(
    private readonly installTools: Pick<InstallTools, "execute">,
    private readonly chooseTools: Pick<ChooseTools, "execute"> | undefined,
    private readonly version: string
  ) {}

  async execute({ flow, context }: InstallSetupToolsRequest): Promise<InstallToolsResult> {
    const { aiTools, ideTools } = await this.toolsOf(flow, context);
    return this.installTools.execute({
      projectRoot: flow.projectRoot,
      aiTools,
      ideTools,
      force: flow.force,
      version: this.version,
    });
  }

  private async toolsOf(flow: SetupFlow, context: ProjectContext | undefined) {
    const { aiTools, ideTools } = flow;
    if (this.chooseTools === undefined) return { aiTools, ideTools };
    return this.chooseTools.execute({ interactive: flow.interactive, aiTools, ideTools, context });
  }
}
