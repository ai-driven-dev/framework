import type { AiToolId } from "../../../../shared/domain/tool.js";
import type {
  InspectedHost,
  InspectHostRegistrationRequest,
} from "../../contract/inspect-host-registration-request.js";
import type { NativeHostCatalog } from "../../contract/native-registration-spec.js";
import { answeredRegistry } from "../../domain/reading/host-registration-answers.js";
import type { HostPluginRegistry } from "../../ports/host-plugin-registry.js";
import { pluginFinding } from "./host-registration-findings.js";
import type { HostRegistrationFinding } from "./inspect-host-registration-result.js";

/** Asks each host's plugin registry whether it carries the plugins aidd asked it to register.
 * `pluginRegistries` holds one reader per tool whose own CLI activates plugins. */
export class InspectHostPlugins {
  constructor(
    private readonly pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistry>,
    private readonly tools: NativeHostCatalog
  ) {}

  async execute(command: InspectHostRegistrationRequest): Promise<HostRegistrationFinding[]> {
    const findings: HostRegistrationFinding[] = [];
    for (const host of command.hosts)
      findings.push(...(await this.inspectHost(command.projectRoot, host)));
    return findings;
  }

  private async inspectHost(
    projectRoot: string,
    host: InspectedHost
  ): Promise<HostRegistrationFinding[]> {
    const { tool } = host;
    if (this.tools.aiProfile(tool).nativeActivation() === undefined) return [];
    if (host.expectedPlugins.length === 0) return [];
    const reading = await this.pluginRegistries.get(tool)?.read(projectRoot);
    const answered = answeredRegistry(tool, reading, true);
    if ("detail" in answered)
      return [{ kind: "registry-unanswerable", tool, detail: answered.detail }];
    return host.expectedPlugins.flatMap((item) => pluginFinding(tool, item, answered));
  }
}
