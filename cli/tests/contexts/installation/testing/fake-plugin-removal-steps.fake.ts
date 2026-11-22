import { registrationRecordRules } from "../../../../src/composition/installation.js";
import type {
  PluginHostReach,
  ProjectPluginWithdrawalSteps,
} from "../../../../src/contexts/installation/application/removal/project-plugin-withdrawal.js";
import type { RecordedPlugin } from "../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { RegistrationRecordData } from "../../../../src/contexts/installation/ports/record/registration-records.js";
import type { AiToolId, ToolId } from "../../../../src/shared/domain/tool.js";

interface Answers {
  readonly refuseSource?: Error;
  readonly canDetachRef?: boolean;
}

/** A host that lets a plugin go as told, recording what a removal asked of it and in what order. */
export class FakePluginRemovalSteps implements ProjectPluginWithdrawalSteps {
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

  recordedRef(
    registrations: RegistrationRecordData | undefined,
    recorded: RecordedPlugin
  ): string | undefined {
    return registrationRecordRules.refOf(registrations, recorded.plugin.name, recorded.marketplace);
  }

  withoutRef(registrations: RegistrationRecordData, ref: string): RegistrationRecordData {
    return registrationRecordRules.withoutRef(registrations, ref);
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
