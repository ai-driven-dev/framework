import type {
  PluginHostReach,
  ProjectPluginWithdrawalSteps,
} from "../../../../src/contexts/installation/application/removal/project-plugin-withdrawal.js";
import type { AiToolId, ToolId } from "../../../../src/shared/domain/tool.js";

interface Answers {
  readonly refuseSource?: Error;
  readonly canDetachRef?: boolean;
}

/** A host that lets a plugin go as told, recording what a removal asked of it and in what order. */
export class FakeProjectPluginWithdrawal implements ProjectPluginWithdrawalSteps {
  readonly calls: string[] = [];
  readonly detachedRefs: ReadonlyMap<ToolId, readonly string[]>[] = [];
  readonly detachedUserPlugins: [AiToolId, string][] = [];

  constructor(private readonly answers: Answers = {}) {}

  async assertSource(source: PluginHostReach & { readonly toolId: AiToolId }): Promise<void> {
    this.calls.push(`assertSource:${source.toolId}`);
    if (this.answers.refuseSource !== undefined) throw this.answers.refuseSource;
  }

  async withdraw(reach: PluginHostReach): Promise<boolean | undefined> {
    this.calls.push(`withdraw:${reach.plugin.plugin.name}`);
    return true;
  }

  async canDetachRef(): Promise<boolean> {
    return this.answers.canDetachRef ?? true;
  }

  async detachNativeRefs(
    _projectRoot: string,
    refsByTool: ReadonlyMap<ToolId, readonly string[]>
  ): Promise<void> {
    this.detachedRefs.push(refsByTool);
  }

  async detachUserPlugin(toolId: AiToolId, name: string): Promise<void> {
    this.detachedUserPlugins.push([toolId, name]);
  }
}
