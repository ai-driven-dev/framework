import type { MarketplaceBuilds } from "../../contexts/distribution/contract/built-marketplaces.js";
import type { InspectDeclaredMarketplaces } from "../../contexts/host-registration/application/inspect/inspect-declared-marketplaces.use-case.js";
import type { InspectHostRegistration } from "../../contexts/host-registration/application/inspect/inspect-host-registration.use-case.js";
import { UNDECLARED_MARKETPLACE_SEVERITY } from "../../contexts/host-registration/contract/finding-severity.model.js";
import type { InspectDeclaredMarketplacesResult } from "../../contexts/host-registration/contract/inspect-declared-marketplaces-result.js";
import type { HostCandidate } from "../../contexts/host-registration/contract/inspect-host-registration-request.js";
import type { DoctorIssue } from "../../contexts/installation/contract/doctor-issue.js";
import type { RegisteredPluginsOfTool } from "../../contexts/installation/contract/registered-plugins.js";
import { registrationIssueOf } from "./registration-issues.js";
import type { ResolveRegisteredBuilds } from "./resolve-registered-builds.use-case.js";

export interface CheckRegistrationRequest {
  projectRoot: string;
  allowedIds: Set<string> | null;
  /** A global install declares nothing in a project's settings, so it skips that check. */
  globalInstall?: boolean;
}

export interface CheckRegistrationDeps {
  readonly resolve: Pick<ResolveRegisteredBuilds, "execute">;
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
  constructor(private readonly deps: CheckRegistrationDeps) {}

  async execute(command: CheckRegistrationRequest): Promise<DoctorIssue[]> {
    const { registered, projectScopedNames, userCacheRoot, built } =
      await this.deps.resolve.execute({
        projectRoot: command.projectRoot,
        allowedIds: command.allowedIds,
      });
    return [
      ...(command.globalInstall === true
        ? []
        : await this.undeclaredMarketplaces(
            command,
            registered.map((t) => t.toolId),
            projectScopedNames
          )),
      ...(await this.hostRegistrations({
        command,
        registered,
        built,
        userCacheRoot,
      })),
    ];
  }

  private async undeclaredMarketplaces(
    command: CheckRegistrationRequest,
    toolIds: readonly string[],
    marketplaceNames: readonly string[]
  ): Promise<DoctorIssue[]> {
    const declared: InspectDeclaredMarketplacesResult = await this.deps.declared.execute({
      projectRoot: command.projectRoot,
      toolIds,
      marketplaceNames,
    });
    return declared.findings.map((finding) => ({
      severity: UNDECLARED_MARKETPLACE_SEVERITY,
      message: `${finding.tool} no longer declares marketplace '${finding.name}'`,
      fix: { code: "refresh-marketplace", file: finding.file },
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
    command: CheckRegistrationRequest;
    registered: readonly RegisteredPluginsOfTool[];
    built: MarketplaceBuilds["built"];
    userCacheRoot: string;
  }): Promise<DoctorIssue[]> {
    const hosts: HostCandidate[] = registered.map(({ toolId, expectedPlugins }) => ({
      tool: toolId,
      expectedPlugins,
      marketplaces: built.get(toolId) ?? [],
    }));
    const { findings } = await this.deps.inspectHost.execute({
      projectRoot: command.projectRoot,
      userCacheRoot,
      hosts,
    });
    return findings.map(registrationIssueOf);
  }
}
