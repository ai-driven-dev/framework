import type { DetectProjectContext } from "../../contexts/installation/application/detect-project-context.use-case.js";
import type { InitProject } from "../../contexts/installation/application/init-project.use-case.js";
import type { NativeActivationReport } from "../../contexts/installation/application/install/install-ai-tool.use-case.js";
import type {
  InstallTools,
  InstallToolsResult,
} from "../../contexts/installation/application/install/install-tools.use-case.js";
import type { ProjectContext } from "../../contexts/installation/contract/project-context.js";
import type { AiToolId, IdeToolId } from "../../shared/domain/tool.js";
import type { VersionReader } from "../../shared/ports/version-reader.js";
import { UserScopeUnavailableError } from "../orchestration.error.js";
import type { ResolveSetupSource } from "./resolve-setup-source.use-case.js";
import type {
  PluginInstallMode,
  RegisterFrameworkSource,
  SetupFlow,
  SetupResult,
} from "./setup-flow.js";
import type { SetupMachineScope } from "./setup-machine-scope.use-case.js";

/** What a project-scope setup does, one entry per stage. */
export interface SetupSteps {
  readonly resolveSource: Pick<ResolveSetupSource, "execute">;
  readonly register: RegisterFrameworkSource;
  readonly installTools: Pick<InstallTools, "execute">;
  /** Drives native activation for this project. */
  readonly syncSettings: (options: {
    readonly projectRoot: string;
  }) => Promise<NativeActivationReport>;
  readonly version: VersionReader;
  readonly detectContext?: Pick<DetectProjectContext, "execute">;
  /** Handles `flow.scope === "user"` entirely. Absent, `execute` refuses a request it has
   * nothing to serve. */
  readonly machineScope?: Pick<SetupMachineScope, "execute">;
}

/** What a setup asks a person. The questions are not orchestration's: composition hands them in. */
export interface SetupQuestions {
  readonly plugins: (options: {
    readonly projectRoot: string;
    readonly mode: PluginInstallMode;
    readonly pluginNames: readonly string[];
    readonly interactive: boolean;
  }) => Promise<unknown>;
  readonly tools?: (options: {
    readonly interactive: boolean;
    readonly aiTools: readonly AiToolId[];
    readonly ideTools: readonly IdeToolId[];
    readonly context: ProjectContext | undefined;
  }) => Promise<{
    readonly aiTools: readonly AiToolId[];
    readonly ideTools: readonly IdeToolId[];
  }>;
}

/** `aidd setup`: brings a project from nothing to correct, stage by stage. */
export class RunSetup {
  constructor(
    private readonly steps: SetupSteps,
    private readonly questions: SetupQuestions,
    private readonly initProject: Pick<InitProject, "initializeIfAbsent">
  ) {}

  async execute(flow: SetupFlow): Promise<SetupResult> {
    if (flow.scope === "user") return this.runMachineScope(flow);
    const context = await this.detectContext(flow);
    // Resolved before the manifest is initialized: a non-interactive run with no --source must
    // reject before it ever writes .aidd/manifest.json or touches .gitignore, not after.
    const source = await this.steps.resolveSource.execute(flow);
    const isNew = await this.initProject.initializeIfAbsent({ projectRoot: flow.projectRoot });
    await this.steps.register(flow, source);
    const install = await this.installTools(flow, context);
    if (flow.registerDefaultMarketplace) await this.promptPlugins(flow);
    const activation = await this.steps.syncSettings({ projectRoot: flow.projectRoot });
    return { kind: isNew ? "initialized" : "up-to-date", install, activation, context };
  }

  private async runMachineScope(flow: SetupFlow): Promise<SetupResult> {
    if (this.steps.machineScope === undefined) throw new UserScopeUnavailableError();
    return this.steps.machineScope.execute(flow);
  }

  private async detectContext(flow: SetupFlow): Promise<ProjectContext | undefined> {
    if (this.steps.detectContext === undefined) return undefined;
    return this.steps.detectContext.execute({ projectRoot: flow.projectRoot });
  }

  private async installTools(
    flow: SetupFlow,
    context: ProjectContext | undefined
  ): Promise<InstallToolsResult> {
    const { aiTools, ideTools } = await this.resolveTools(flow, context);
    return this.steps.installTools.execute({
      projectRoot: flow.projectRoot,
      aiTools,
      ideTools,
      force: flow.force,
      version: this.steps.version.get(),
    });
  }

  private async resolveTools(
    flow: SetupFlow,
    context: ProjectContext | undefined
  ): Promise<{ aiTools: readonly AiToolId[]; ideTools: readonly IdeToolId[] }> {
    const { aiTools, ideTools } = flow;
    if (this.questions.tools === undefined) return { aiTools, ideTools };
    return this.questions.tools({
      interactive: flow.interactive,
      aiTools,
      ideTools,
      context,
    });
  }

  private async promptPlugins(flow: SetupFlow): Promise<void> {
    await this.questions.plugins({
      projectRoot: flow.projectRoot,
      mode: flow.pluginMode,
      pluginNames: [...flow.pluginNames],
      interactive: flow.interactive,
    });
  }
}
