import type { DetectProjectContext } from "../../contexts/installation/application/detect-project-context.js";
import type { InitProject } from "../../contexts/installation/application/init-project.js";
import type { NativeActivationReport } from "../../contexts/installation/application/install/install-ai-tool.js";
import type {
  InstallTools,
  InstallToolsResult,
} from "../../contexts/installation/application/install/install-tools.js";
import type { ProjectContext } from "../../contexts/installation/contract/project-context.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import { UserScopeUnavailableError } from "../../shared/domain/errors.js";
import type { AiToolId, IdeToolId } from "../../shared/domain/tool.js";
import type { VersionReader } from "../../shared/ports/version-reader.js";
import type { PluginInstallMode, SetupFlow, SetupResult } from "./setup-flow.js";
import type { SetupMachineScope } from "./setup-machine-scope.js";
import type { SetupMarketplaceRegistration } from "./setup-marketplace-registration.js";

/** What a project-scope setup does, one entry per stage. */
export interface SetupSteps {
  readonly registration: Pick<
    SetupMarketplaceRegistration,
    "resolveSourceIfNeeded" | "registerIfPresent"
  >;
  readonly installTools: Pick<InstallTools, "execute">;
  /** Drives native activation for this project. */
  readonly syncSettings: (options: {
    readonly projectRoot: string;
    readonly tools: ToolCatalog;
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
    readonly tools: ToolCatalog;
  }) => Promise<unknown>;
  readonly tools?: (options: {
    readonly interactive: boolean;
    readonly aiTools: readonly AiToolId[];
    readonly ideTools: readonly IdeToolId[];
    readonly tools: ToolCatalog;
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

  async execute(flow: SetupFlow, tools: ToolCatalog): Promise<SetupResult> {
    if (flow.scope === "user") return this.runMachineScope(flow, tools);
    const context = await this.detectContext(flow);
    // Resolved before the manifest is initialized: a non-interactive run with no --source must
    // reject before it ever writes .aidd/manifest.json or touches .gitignore, not after.
    const source = await this.steps.registration.resolveSourceIfNeeded(flow);
    const isNew = await this.initProject.initializeIfAbsent({
      projectRoot: flow.projectRoot,
      tools,
    });
    await this.steps.registration.registerIfPresent(flow, source);
    const install = await this.installTools(flow, context, tools);
    if (flow.registerDefaultMarketplace) await this.promptPlugins(flow, tools);
    const activation = await this.steps.syncSettings({ projectRoot: flow.projectRoot, tools });
    return this.buildResult(isNew, install, activation, context);
  }

  private async runMachineScope(flow: SetupFlow, tools: ToolCatalog): Promise<SetupResult> {
    if (this.steps.machineScope === undefined) throw new UserScopeUnavailableError();
    return this.steps.machineScope.execute(flow, tools);
  }

  private async detectContext(flow: SetupFlow): Promise<ProjectContext | undefined> {
    if (this.steps.detectContext === undefined) return undefined;
    return this.steps.detectContext.execute({ projectRoot: flow.projectRoot });
  }

  private async installTools(
    flow: SetupFlow,
    context: ProjectContext | undefined,
    tools: ToolCatalog
  ): Promise<InstallToolsResult> {
    const { aiTools, ideTools } = await this.resolveTools(flow, context, tools);
    return this.steps.installTools.execute({
      projectRoot: flow.projectRoot,
      aiTools,
      ideTools,
      force: flow.force,
      version: this.steps.version.get(),
      tools,
    });
  }

  private async resolveTools(
    flow: SetupFlow,
    context: ProjectContext | undefined,
    tools: ToolCatalog
  ): Promise<{ aiTools: readonly AiToolId[]; ideTools: readonly IdeToolId[] }> {
    const { aiTools, ideTools } = flow;
    if (this.questions.tools === undefined) return { aiTools, ideTools };
    return this.questions.tools({
      interactive: flow.interactive,
      aiTools,
      ideTools,
      tools,
      context,
    });
  }

  private async promptPlugins(flow: SetupFlow, tools: ToolCatalog): Promise<void> {
    await this.questions.plugins({
      projectRoot: flow.projectRoot,
      mode: flow.pluginMode,
      pluginNames: [...flow.pluginNames],
      interactive: flow.interactive,
      tools,
    });
  }

  private buildResult(
    isNew: boolean,
    install: InstallToolsResult,
    activation: NativeActivationReport,
    context: ProjectContext | undefined
  ): SetupResult {
    return { kind: isNew ? "initialized" : "up-to-date", install, activation, context };
  }
}
