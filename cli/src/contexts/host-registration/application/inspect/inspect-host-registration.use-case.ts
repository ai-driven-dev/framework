import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { InspectCandidateHostsRequest } from "../../contract/inspect-host-registration-request.js";
import type { InspectHostRegistrationResult } from "../../contract/inspect-host-registration-result.js";
import type { InspectHostMarketplaceSources } from "./inspect-host-marketplace-sources.use-case.js";
import type { InspectHostPlugins } from "./inspect-host-plugins.use-case.js";

/**
 * Asks each host's own registries whether they carry what aidd asked them to register, and
 * whether a marketplace they already hold points somewhere other than this project's build.
 */
export class InspectHostRegistration {
  constructor(
    private readonly plugins: Pick<InspectHostPlugins, "execute">,
    private readonly sources: Pick<InspectHostMarketplaceSources, "execute">,
    private readonly tools: Pick<ToolCatalog, "isAiTool">
  ) {}

  /** An editor is no host: it keeps no registry of its own, so only AI tools are asked. */
  async execute(command: InspectCandidateHostsRequest): Promise<InspectHostRegistrationResult> {
    const hosts = command.hosts.flatMap((host) =>
      this.tools.isAiTool(host.tool) ? [{ ...host, tool: host.tool }] : []
    );
    const asked = { ...command, hosts };
    return {
      findings: [...(await this.plugins.execute(asked)), ...(await this.sources.execute(asked))],
    };
  }
}
