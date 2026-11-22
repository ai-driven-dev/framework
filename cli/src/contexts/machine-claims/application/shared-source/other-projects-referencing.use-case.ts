import { samePathSegment } from "../../../../shared/domain/paths.js";
import type { UserSourceReferences } from "../../ports/user-source-references.js";

export class OtherProjectsReferencing {
  constructor(
    private readonly userSourceReferences: UserSourceReferences,
    /** The platform whose path rules decide whether two project roots are the same one. */
    private readonly platform: string
  ) {}

  /**
   * Every project this file still names as referencing the shared source, minus `ownRoot`: the one
   * denominator every caller reads, so a project that never had a claim of its own to drop reads the
   * same "other projects" fact as one that just dropped one. `ownRoot` must already be resolved
   * through `ResolveReferenceRoot`; this does not resolve it itself.
   */
  async execute(ownRoot: string): Promise<readonly string[]> {
    return (await this.userSourceReferences.listAllReferencingProjects()).filter(
      (root) => !samePathSegment(root, ownRoot, this.platform)
    );
  }
}
