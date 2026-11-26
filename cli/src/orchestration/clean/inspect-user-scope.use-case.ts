import type { PurgeUserScopeFiles } from "../../contexts/installation/application/clean/purge-user-scope-files.js";
import type { HintedMessage } from "../../shared/domain/describe-error.js";
import type { ToolId } from "../../shared/domain/tool.js";
import type { Logger } from "../../shared/ports/logger.js";
import type { CleanClaims } from "./clean-claims.js";

export interface CleanUserScopePreview {
  toolIds: readonly ToolId[];
  activePluginDependents: readonly string[];
  /** Every version directory found under `userConfigDir()/cache/built/`: read structurally,
   * never trusted from any one tool's own manifest entry. */
  builtVersions: readonly string[];
  /** Every project on this machine that `references.json` still names, existing paths only. Empty
   * when the port was never wired in, or nothing else references the source. */
  referencingProjects: readonly string[];
}

export type UserScopeInspected = Awaited<ReturnType<PurgeUserScopeFiles["inspect"]>>;

export interface InspectedUserScope {
  inspection: UserScopeInspected;
  manifestFound: boolean;
  preview: CleanUserScopePreview;
  /** What a non-`--force` run asks the person before it removes anything. */
  question: string;
}

export interface InspectUserScopeDeps {
  readonly purgeFiles: Pick<PurgeUserScopeFiles, "inspect">;
  readonly claims: Pick<CleanClaims, "referencingProjects" | "frameworkMarketplaceName">;
  readonly logger: Logger;
}

/** What `aidd clean --scope user` would remove from the machine, and what the person is asked. A
 * run without a user manifest says so in the log. */
export class InspectUserScope {
  constructor(private readonly deps: InspectUserScopeDeps) {}

  async execute(): Promise<InspectedUserScope> {
    const inspection = await this.deps.purgeFiles.inspect(
      async () => (await this.deps.claims.referencingProjects?.listAllReferencingProjects()) ?? []
    );
    const { manifestFound, ...preview } = inspection;
    if (!manifestFound) this.deps.logger.info(this.describeNoUserRegistration(preview));
    return { inspection, manifestFound, preview, question: this.confirmationMessage(preview) };
  }

  /** What a manifest-less run states plainly, in the logged output and in a non-`--force` run's
   * confirmation: no host registration exists to undo, and, when `references.json` still lists
   * other projects, that each must run its own `aidd clean` first: their hosts still resolve the
   * shared source this run is about to purge. */
  private describeNoUserRegistration(preview: CleanUserScopePreview): string | HintedMessage {
    const base = "No host registration was undone: nothing was registered at user scope.";
    if (preview.referencingProjects.length === 0) return base;
    const projects = preview.referencingProjects.join(", ");
    return {
      text: `${base} ${projects} still resolve the shared source through their own host`,
      hint: "full-removal",
    };
  }

  private confirmationMessage(preview: CleanUserScopePreview): string {
    const versions =
      preview.builtVersions.length > 0 ? preview.builtVersions.join(", ") : "none built yet";
    const projects =
      preview.referencingProjects.length > 0
        ? preview.referencingProjects.join(", ")
        : "no other project";
    return (
      `Remove the shared '${this.deps.claims.frameworkMarketplaceName}' source for this machine ` +
      `(versions: ${versions})? Still referenced by: ${projects}.`
    );
  }
}
