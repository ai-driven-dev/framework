import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Lock } from "../../../shared/ports/lock.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { MachineManifestRepository } from "../ports/machine-manifest.js";
import type { UserSourceReferences } from "../ports/user-source-references.js";
import { detachProjectClaims } from "./detach-project-claims.js";
import {
  frameworkSourceIsShared,
  otherProjectsReferencing,
  resolveProjectRootForReferences,
  toleratingUnreadableSourceReferences,
} from "./shared-source-reference-support.js";

/** Where a project's own claim on the shared source stands, read before any host cleanup. */
export interface SharedSourceClaim {
  readonly alias: string;
  readonly resolvedRoot: string;
  readonly otherProjects: readonly string[];
}

/** What names the shared source and decides which project roots are the same one. */
interface SharedSourceIdentity {
  readonly frameworkMarketplaceName: string;
  /** The platform whose path rules compare two project roots. */
  readonly platform: string;
}

/** The marketplaces registered for a project, listed only when a claim is actually looked up. */
type ListMarketplaces = () => Promise<readonly { name: string; scope: MarketplaceScope }[]>;

/**
 * What a clean reads and releases on the machine record: the projects still referencing the shared
 * source, this project's own claim on it, and the plugin claims it holds in the user manifest.
 * Absent ports report nothing rather than guessing.
 */
export class ReleaseClaims {
  constructor(
    private readonly fs: FileReader,
    private readonly logger: Logger,
    private readonly sharedSource: SharedSourceIdentity,
    private readonly userManifestRepo?: MachineManifestRepository & Lock,
    private readonly userSourceReferences?: UserSourceReferences
  ) {}

  /** Every project on this machine that `references.json` still names, existing paths only. */
  async referencingProjects(): Promise<readonly string[]> {
    if (this.userSourceReferences === undefined) return [];
    return this.userSourceReferences.listAllReferencingProjects();
  }

  /** Read-only: the *other* projects on this machine that reference the shared source. Reads across
   * every version key, so a dry-run and a `--force` run see the same fact. `undefined` when the
   * port was never wired in, or no shared, machine-scope marketplace is registered locally. */
  async otherProjects(
    projectRoot: string,
    list: ListMarketplaces
  ): Promise<readonly string[] | undefined> {
    const claim = await this.claim(projectRoot, list);
    return claim?.otherProjects;
  }

  /** This project's claim on the shared source and who else holds one, read before the host is
   * touched; `undefined` when there is none to act on. */
  async claim(projectRoot: string, list: ListMarketplaces): Promise<SharedSourceClaim | undefined> {
    const references = this.userSourceReferences;
    if (references === undefined) return undefined;
    const shared = (await list()).find((m) =>
      frameworkSourceIsShared(m.name, m.scope, this.sharedSource.frameworkMarketplaceName)
    );
    if (shared === undefined) return undefined;
    return toleratingUnreadableSourceReferences(this.logger, undefined, async () => {
      const resolvedRoot = await resolveProjectRootForReferences(this.fs, projectRoot);
      return {
        alias: shared.name,
        resolvedRoot,
        otherProjects: await otherProjectsReferencing(
          references,
          resolvedRoot,
          this.sharedSource.platform
        ),
      };
    });
  }

  /** Decrements this project's claim exactly once. The resolved root was captured before
   * `.aidd/` and its local marketplace registry were deleted. */
  async drop(resolvedRoot: string | undefined): Promise<void> {
    const references = this.userSourceReferences;
    if (references === undefined || resolvedRoot === undefined) return;
    await toleratingUnreadableSourceReferences(this.logger, undefined, () =>
      references.removeReference(resolvedRoot)
    );
  }

  /** Releases the project's native-registration refs, then each user plugin, from the machine
   * manifest. */
  detach(
    projectRoot: string,
    userPlugins: readonly { toolId: AiToolId; name: string }[],
    nativeRefs: ReadonlyMap<ToolId, readonly string[]>
  ): Promise<void> {
    return detachProjectClaims(this.userManifestRepo, this.fs)(
      projectRoot,
      userPlugins,
      nativeRefs
    );
  }

  /** The machine-wide claims on `toolId`'s refs; `undefined` when no machine record exists. */
  async machineClaims(toolId: AiToolId) {
    const machine = await this.userManifestRepo?.load();
    if (machine === undefined || machine === null) return undefined;
    return machine.getNativeRegistrations(toolId)?.pluginClaims ?? [];
  }

  /** Runs `action` holding the machine record's lock when there is one to lock. */
  exclusive<T>(action: () => Promise<T>): Promise<T> {
    const repo = this.userManifestRepo;
    return repo === undefined ? action() : repo.withExclusiveAccess(action);
  }
}
