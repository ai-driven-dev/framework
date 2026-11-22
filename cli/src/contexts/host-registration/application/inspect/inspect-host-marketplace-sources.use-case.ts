import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type {
  InspectedHost,
  InspectedMarketplace,
  InspectHostRegistrationRequest,
} from "../../contract/inspect-host-registration-request.js";
import type { HostRegistrationFinding } from "../../contract/inspect-host-registration-result.js";
import type { HostMarketplaceSourceCheck } from "../../domain/source/marketplace-source-drift.js";
import type { CatalogIdentityReader } from "../../ports/catalog-identity-reader.js";
import type { HostMarketplaceRegistry } from "../../ports/host-marketplace-registry.js";
import type { CatalogProbeTool } from "../../ports/host-tool.js";
import { hostMarketplaceSourceConflict } from "../check-marketplace-source.use-case.js";
import { sourceFinding } from "./host-registration-findings.js";

/**
 * Asks each host's marketplace registry whether a marketplace it already holds points somewhere
 * other than this project's build. Only a tool whose profile declares a marketplace registry is
 * ever looked up in `marketplaceRegistries`; `platform` decides what a stored source names.
 *
 * Silent on a host with no registry reader and on a catalog whose identity cannot be read:
 * reporting a conflict against a path nothing has ever pointed at would invent the false positive
 * the sync-time guard exists to prevent.
 */
export class InspectHostMarketplaceSources {
  constructor(
    private readonly fs: FileReader,
    private readonly identities: CatalogIdentityReader,
    private readonly marketplaceRegistries: ReadonlyMap<AiToolId, HostMarketplaceRegistry>,
    private readonly platform: string,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: InspectHostRegistrationRequest): Promise<HostRegistrationFinding[]> {
    const findings: HostRegistrationFinding[] = [];
    for (const host of command.hosts) findings.push(...(await this.inspectHost(command, host)));
    return findings;
  }

  private async inspectHost(
    command: InspectHostRegistrationRequest,
    host: InspectedHost
  ): Promise<HostRegistrationFinding[]> {
    const { tool } = host;
    const profile = this.tools.aiProfile(tool);
    if (profile.nativeActivation()?.keepsMarketplaceRegistry() !== true) return [];
    const reader = this.marketplaceRegistries.get(tool);
    if (reader === undefined) return [];
    const findings: HostRegistrationFinding[] = [];
    for (const marketplace of host.marketplaces) {
      const check = await this.checkSource({ command, tool, profile, reader }, marketplace);
      if (check !== undefined) findings.push(sourceFinding(tool, check));
    }
    return findings;
  }

  // Keyed by the catalog's own declared name, never `marketplace.name` (aidd's local alias): a
  // host's registry only ever holds an entry under the name its own catalog declares. The
  // drift context goes to every entry whatever its recorded `scope`, since an unmigrated
  // project-scope registration is exactly the case it decides.
  private async checkSource(
    scene: {
      readonly command: InspectHostRegistrationRequest;
      readonly tool: AiToolId;
      readonly profile: CatalogProbeTool;
      readonly reader: HostMarketplaceRegistry;
    },
    marketplace: InspectedMarketplace
  ): Promise<HostMarketplaceSourceCheck | undefined> {
    const { command, tool, profile, reader } = scene;
    const { fs, identities, platform } = this;
    const requestedIdentity = await identities.read(profile, marketplace.builtDir);
    if (requestedIdentity === undefined) return undefined;
    return hostMarketplaceSourceConflict(
      { fs, identities, tool: profile, reader },
      {
        requestedSource: marketplace.builtDir,
        requestedIdentity,
        driftContext: {
          userCacheRoot: command.userCacheRoot,
          projectRoot: command.projectRoot,
          marketplaceName: marketplace.name,
          target: tool,
          platform,
        },
      }
    );
  }
}
