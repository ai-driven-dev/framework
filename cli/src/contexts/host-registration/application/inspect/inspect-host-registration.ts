import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type {
  HostRegistrationFinding,
  InspectHostRegistrationResult,
} from "../../contract/inspect-host-registration-result.js";
import { answeredRegistry } from "../../domain/reading/host-registration-answers.js";
import type { HostMarketplaceRegistry } from "../../ports/host-marketplace-registry.js";
import type { HostPluginRegistry } from "../../ports/host-plugin-registry.js";
import type { CatalogProbeTool } from "../../ports/host-tool.js";
import {
  type HostMarketplaceSourceCheck,
  hostMarketplaceSourceConflict,
} from "../host-marketplace-source-conflict.js";
import { readCatalogIdentity } from "../read-marketplace-catalog-identity.js";
import { pluginFinding, sourceFinding } from "./host-registration-findings.js";

/** A plugin the host is expected to carry, and the ref to look it up by: `ref` is absent exactly
 * when nothing can build one. */
export interface ExpectedHostPlugin {
  readonly plugin: string;
  readonly ref?: string;
}

/** A marketplace the project registers, with where this run's build of it lives. A marketplace
 * with no build, never built or gone since, is left out by the caller: nothing to compare. */
export interface InspectedMarketplace {
  readonly name: string;
  readonly builtDir: string;
}

export interface InspectedHost {
  readonly tool: AiToolId;
  readonly expectedPlugins: readonly ExpectedHostPlugin[];
  readonly marketplaces: readonly InspectedMarketplace[];
}

export interface InspectHostRegistrationCommand {
  readonly projectRoot: string;
  readonly userCacheRoot: string;
  readonly hosts: readonly InspectedHost[];
}

/** What the host registries are read through. Only a tool whose profile declares a marketplace
 * registry is ever looked up in `marketplaceRegistries`. */
export interface InspectHostRegistrationDeps {
  readonly fs: FileReader;
  /** Host plugin registry readers, one per tool whose own CLI activates plugins. */
  readonly pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistry>;
  readonly marketplaceRegistries: ReadonlyMap<AiToolId, HostMarketplaceRegistry>;
  /** The platform whose path rules decide what a host's stored source names. */
  readonly platform: string;
}

/**
 * Asks each host's own registries whether they carry what aidd asked them to register, and
 * whether a marketplace they already hold points somewhere other than this project's build.
 *
 * Silent on a host with no registry reader and on a catalog whose
 * identity cannot be read: reporting a conflict against a path nothing has ever pointed at would
 * invent the false positive the sync-time guard exists to prevent.
 */
export class InspectHostRegistration {
  constructor(
    private readonly deps: InspectHostRegistrationDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: InspectHostRegistrationCommand): Promise<InspectHostRegistrationResult> {
    const findings: HostRegistrationFinding[] = [];
    for (const host of command.hosts) findings.push(...(await this.inspectPlugins(command, host)));
    for (const host of command.hosts) findings.push(...(await this.inspectSources(command, host)));
    return { findings };
  }

  private async inspectPlugins(
    command: InspectHostRegistrationCommand,
    host: InspectedHost
  ): Promise<HostRegistrationFinding[]> {
    const { tool } = host;
    if (this.tools.aiProfile(tool).nativeActivation() === undefined) return [];
    if (host.expectedPlugins.length === 0) return [];
    const reading = await this.deps.pluginRegistries.get(tool)?.read(command.projectRoot);
    const answered = answeredRegistry(tool, reading, true);
    if ("detail" in answered)
      return [{ kind: "registry-unanswerable", tool, detail: answered.detail }];
    return host.expectedPlugins.flatMap((item) => pluginFinding(tool, item, answered));
  }

  private async inspectSources(
    command: InspectHostRegistrationCommand,
    host: InspectedHost
  ): Promise<HostRegistrationFinding[]> {
    const { tool } = host;
    const profile = this.tools.aiProfile(tool);
    if (profile.nativeActivation()?.keepsMarketplaceRegistry() !== true) return [];
    const reader = this.deps.marketplaceRegistries.get(tool);
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
      readonly command: InspectHostRegistrationCommand;
      readonly tool: AiToolId;
      readonly profile: CatalogProbeTool;
      readonly reader: HostMarketplaceRegistry;
    },
    marketplace: InspectedMarketplace
  ): Promise<HostMarketplaceSourceCheck | undefined> {
    const { command, tool, profile, reader } = scene;
    const { fs, platform } = this.deps;
    const requestedIdentity = await readCatalogIdentity(fs, profile, marketplace.builtDir);
    if (requestedIdentity === undefined) return undefined;
    return hostMarketplaceSourceConflict(
      { fs, tool: profile, reader },
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
