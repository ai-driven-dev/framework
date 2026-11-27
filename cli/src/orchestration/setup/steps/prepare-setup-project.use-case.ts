import type { DetectProjectContext } from "../../../contexts/installation/application/detect-project-context.use-case.js";
import type { InitProject } from "../../../contexts/installation/application/init-project.use-case.js";
import type { ProjectContext } from "../../../contexts/installation/contract/project-context.js";
import type { ResolveSetupSource } from "../resolve-setup-source.use-case.js";
import type { ClaimFrameworkSource, RegisterFrameworkSource } from "../setup-flow.js";
import type { SetupFlow } from "../setup-flow.model.js";

export interface PreparedSetupProject {
  readonly context: ProjectContext | undefined;
  /** Whether this run created the manifest the setup works on. */
  readonly isNew: boolean;
  readonly claimSource: ClaimFrameworkSource | undefined;
}

/** Gets a project ready for a setup: what it holds, which source it follows, its manifest. */
export class PrepareSetupProject {
  constructor(
    private readonly detectContext: Pick<DetectProjectContext, "execute"> | undefined,
    private readonly resolveSource: Pick<ResolveSetupSource, "execute">,
    private readonly initProject: Pick<InitProject, "execute">,
    private readonly register: RegisterFrameworkSource
  ) {}

  async execute(flow: SetupFlow): Promise<PreparedSetupProject> {
    const context =
      this.detectContext === undefined
        ? undefined
        : await this.detectContext.execute({ projectRoot: flow.projectRoot });
    // Resolved before the manifest is initialized: a non-interactive run with no --source must
    // reject before it ever writes .aidd/manifest.json or touches .gitignore, not after.
    const source = await this.resolveSource.execute(flow);
    const { created: isNew } = await this.initProject.execute({
      projectRoot: flow.projectRoot,
      ifAbsent: true,
    });
    const claimSource = await this.register(flow, source);
    return { context, isNew, claimSource };
  }
}
