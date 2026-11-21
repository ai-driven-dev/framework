import type { ResolveBuiltMarketplaces } from "../../contexts/distribution/application/resolve-built-marketplaces.js";
import type { MarketplaceBuilds } from "../../contexts/distribution/contract/built-marketplaces.js";
import type { InspectDeclaredMarketplaces } from "../../contexts/host-registration/application/inspect/inspect-declared-marketplaces.js";
import type {
  InspectedHost,
  InspectHostRegistration,
} from "../../contexts/host-registration/application/inspect/inspect-host-registration.js";
import type { InspectDeclaredMarketplacesResult } from "../../contexts/host-registration/contract/inspect-declared-marketplaces-result.js";
import type { HostRegistrationFinding } from "../../contexts/host-registration/contract/inspect-host-registration-result.js";
import type { MarketplaceSourceDriftFound } from "../../contexts/host-registration/contract/marketplace-source-drift.js";
import type { ListRegisteredPlugins } from "../../contexts/installation/application/doctor/list-registered-plugins.js";
import type { DoctorIssue } from "../../contexts/installation/contract/doctor-issue.js";
import type { RegisteredPluginsOfTool } from "../../contexts/installation/contract/registered-plugins.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { AiToolId } from "../../shared/domain/tool.js";

export interface CheckRegistrationCommand {
  projectRoot: string;
  allowedIds: Set<string> | null;
  /** A global install declares nothing in a project's settings, so it skips that check. */
  globalInstall?: boolean;
}

export interface CheckRegistrationDeps {
  readonly listPlugins: ListRegisteredPlugins;
  readonly builds: Pick<ResolveBuiltMarketplaces, "execute">;
  readonly declared: InspectDeclaredMarketplaces;
  readonly inspectHost: Pick<InspectHostRegistration, "execute">;
}

/**
 * Checks the registrations the CLI writes but does not track, worded as doctor issues.
 *
 * Two unrelated facets share this check because they share a shape: both look past a tracked
 * file's own hash, at state a tool's own CLI wrote and this CLI only observes. A tool's
 * machine-local settings file is deliberately untracked (absolute paths), so nothing else would
 * notice it emptied, edited or deleted; a native-activation tool's own plugin registry answers
 * `registered`, `not-registered`, `registered-disabled` or `unanswerable`, and only the first two
 * are errors: `unanswerable` is the normal state on a machine that has never run that binary.
 */
export class CheckRegistration {
  constructor(
    private readonly deps: CheckRegistrationDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: CheckRegistrationCommand): Promise<DoctorIssue[]> {
    const { projectRoot, allowedIds } = command;
    const registered = await this.deps.listPlugins.execute({ allowedIds });
    const aiToolIds: AiToolId[] = [];
    for (const { toolId } of registered.tools) {
      if (this.tools.isAiTool(toolId)) aiToolIds.push(toolId);
    }
    const { registeredNames, userCacheRoot, built } = await this.deps.builds.execute({
      projectRoot,
      toolIds: aiToolIds,
    });
    return [
      ...(command.globalInstall === true
        ? []
        : await this.undeclaredMarketplaces(
            command,
            registered.tools.map((t) => t.toolId),
            registeredNames
          )),
      ...(await this.hostRegistrations({
        command,
        registered: registered.tools,
        built,
        userCacheRoot,
      })),
    ];
  }

  private async undeclaredMarketplaces(
    command: CheckRegistrationCommand,
    toolIds: readonly string[],
    marketplaceNames: readonly string[]
  ): Promise<DoctorIssue[]> {
    const declared: InspectDeclaredMarketplacesResult = await this.deps.declared.execute({
      projectRoot: command.projectRoot,
      toolIds,
      marketplaceNames,
    });
    return declared.findings.map((finding) => ({
      severity: "warning",
      message: `${finding.tool} no longer declares marketplace '${finding.name}'`,
      fix: `Run \`aidd marketplace refresh\` to write it back to ${finding.file}.`,
    }));
  }

  /**
   * What a host's own registries say about what this project asked them to register. Includes
   * whether a host's marketplace registry already holds this project's marketplace name pointed
   * at a source other than the one this project would register: the doctor-side half of the
   * sync-time guard, so a conflict is visible between two `sync` runs.
   */
  private async hostRegistrations({
    command,
    registered,
    built,
    userCacheRoot,
  }: {
    command: CheckRegistrationCommand;
    registered: readonly RegisteredPluginsOfTool[];
    built: MarketplaceBuilds["built"];
    userCacheRoot: string;
  }): Promise<DoctorIssue[]> {
    const hosts: InspectedHost[] = [];
    for (const { toolId, expectedPlugins } of registered) {
      if (!this.tools.isAiTool(toolId)) continue;
      hosts.push({
        tool: toolId,
        expectedPlugins,
        marketplaces: built.get(toolId) ?? [],
      });
    }
    const { findings } = await this.deps.inspectHost.execute({
      projectRoot: command.projectRoot,
      userCacheRoot,
      hosts,
    });
    return findings.map((finding) => this.issueOf(finding));
  }

  private issueOf(finding: HostRegistrationFinding): DoctorIssue {
    const { tool } = finding;
    switch (finding.kind) {
      case "registry-unanswerable":
        return {
          severity: "info",
          message: finding.detail,
          fix: `The plugin does not load until ${tool}'s own CLI has run and answered this.`,
        };
      case "plugin-unrecorded":
        return {
          severity: "info",
          message: `AIDD records no marketplace for ${finding.plugin} (${tool}), so its registry cannot be asked`,
          fix: `${tool} will not load it until a marketplace is recorded for it.`,
        };
      case "plugin-missing":
        return {
          severity: "error",
          message: `${tool}'s registry (${finding.location}) does not carry ${finding.ref}`,
          fix: "Run `aidd sync` to re-register it.",
        };
      case "plugin-disabled":
        return {
          severity: "error",
          message: `${tool}'s registry (${finding.location}) carries ${finding.ref} and records it disabled`,
          fix: `Run \`aidd framework install --tool ${tool}\`.`,
        };
      case "source-drift":
        return this.driftIssue(tool, finding.found);
      case "source-conflict": {
        const check = finding;
        return {
          severity: "error",
          message: `${tool}'s marketplace registry (${check.location}) carries '${check.name}' from a different catalog (${check.registeredSource}) than this project's own (${check.requestedSource}) — plugins ${finding.pluginDiff}`,
          fix: `Run \`claude plugin marketplace remove ${check.name}\`, then \`aidd sync\` to re-register it for this project — or rename this project's marketplace if it is meant to point elsewhere.`,
        };
      }
    }
  }

  /** Both `warning`, never `error`: neither drift is a fault this project caused, and neither
   * blocks anything the way a genuine different-catalog conflict does. */
  private driftIssue(toolId: AiToolId, found: MarketplaceSourceDriftFound): DoctorIssue {
    const { drift } = found;
    if (drift.kind === "version-behind") {
      return {
        severity: "warning",
        message: `${toolId}'s marketplace registry (${found.location}) already carries a newer aidd-framework build, ${drift.registeredVersion}, than this run's own ${drift.requestedVersion}`,
        fix: "Run `aidd update` to bring this project's CLI to at least the version the host already follows.",
      };
    }
    if (drift.kind === "unmigrated-foreign-project-source") {
      return {
        severity: "warning",
        message: `${toolId}'s marketplace registry (${found.location}) still carries '${found.name}' from another project's pre-migration cache (${found.registeredSource})`,
        fix: "Run `aidd sync` to move it to the shared, machine-scope source.",
      };
    }
    return {
      severity: "warning",
      message: `${toolId}'s marketplace registry (${found.location}) still carries '${found.name}' from this project's own pre-migration cache (${found.registeredSource})`,
      fix: "Run `aidd sync` to move it to the shared, machine-scope source.",
    };
  }
}
