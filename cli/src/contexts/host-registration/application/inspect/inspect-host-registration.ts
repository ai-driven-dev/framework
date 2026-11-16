import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type {
  HostRegistrationFinding,
  InspectHostRegistrationResult,
} from "../../contract/inspect-host-registration-result.js";
import { answeredRegistry } from "../../domain/host-registration-answers.js";
import {
  describePluginDiff,
  pluginSetDifference,
} from "../../domain/marketplace-source-conflict.js";
import type { HostMarketplaceRegistry } from "../../ports/host-marketplace-registry.js";
import type { HostPluginRegistry } from "../../ports/host-plugin-registry.js";
import {
  hostMarketplaceSourceConflict,
  isDriftFound,
} from "../host-marketplace-source-conflict.js";
import { readMarketplaceCatalogIdentity } from "../read-marketplace-catalog-identity.js";

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
  readonly tools: ToolCatalog;
  readonly hosts: readonly InspectedHost[];
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
    private readonly fs: FileReader,
    /** Host plugin registry readers, one per tool whose own CLI activates plugins. */
    private readonly pluginRegistries: ReadonlyMap<AiToolId, HostPluginRegistry>,
    /** Host marketplace registry readers. Only a tool whose profile declares a marketplace
     * registry is ever looked up here. */
    private readonly marketplaceRegistries: ReadonlyMap<AiToolId, HostMarketplaceRegistry>,
    /** The platform whose path rules decide what a host's stored source names. */
    private readonly platform: string
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
    if (command.tools.aiProfile(tool).nativeActivation() === undefined) return [];
    if (host.expectedPlugins.length === 0) return [];
    const reading = await this.pluginRegistries.get(tool)?.read(command.projectRoot);
    const answered = answeredRegistry(tool, reading, true);
    if ("detail" in answered)
      return [{ kind: "registry-unanswerable", tool, detail: answered.detail }];
    const findings: HostRegistrationFinding[] = [];
    for (const item of host.expectedPlugins) {
      if (item.ref === undefined) {
        findings.push({ kind: "plugin-unrecorded", tool, plugin: item.plugin });
        continue;
      }
      const entry = answered.refs.get(item.ref);
      if (entry === undefined) {
        findings.push({ kind: "plugin-missing", tool, ref: item.ref, location: answered.location });
      } else if (!entry.enabled) {
        findings.push({
          kind: "plugin-disabled",
          tool,
          ref: item.ref,
          location: answered.location,
        });
      }
    }
    return findings;
  }

  private async inspectSources(
    command: InspectHostRegistrationCommand,
    host: InspectedHost
  ): Promise<HostRegistrationFinding[]> {
    const { tool } = host;
    const profile = command.tools.aiProfile(tool);
    if (profile.nativeActivation()?.keepsMarketplaceRegistry() !== true) return [];
    const reader = this.marketplaceRegistries.get(tool);
    if (reader === undefined) return [];
    const findings: HostRegistrationFinding[] = [];
    for (const marketplace of host.marketplaces) {
      const requestedIdentity = await readMarketplaceCatalogIdentity(
        this.fs,
        profile,
        marketplace.builtDir
      );
      if (requestedIdentity === undefined) continue;
      // Keyed by the catalog's own declared name, never `marketplace.name` (aidd's local alias): a
      // host's registry only ever holds an entry under the name its own catalog declares. The
      // drift context goes to every entry whatever its recorded `scope`, since an unmigrated
      // project-scope registration is exactly the case it decides.
      const check = await hostMarketplaceSourceConflict(
        this.fs,
        profile,
        reader,
        marketplace.builtDir,
        requestedIdentity,
        {
          userCacheRoot: command.userCacheRoot,
          projectRoot: command.projectRoot,
          marketplaceName: marketplace.name,
          target: tool,
          platform: this.platform,
        }
      );
      if (check === undefined) continue;
      findings.push(
        isDriftFound(check)
          ? { kind: "source-drift", tool, found: check }
          : {
              kind: "source-conflict",
              tool,
              name: check.name,
              location: check.location,
              registeredSource: check.registeredSource,
              requestedSource: check.requestedSource,
              pluginDiff: describePluginDiff(
                pluginSetDifference(check.registeredIdentity, check.requestedIdentity)
              ),
            }
      );
    }
    return findings;
  }
}
