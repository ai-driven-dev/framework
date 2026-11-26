import type { Scope } from "../../../../shared/domain/scope.js";
import { frameworkSourceIsShared } from "../../domain/shared-source-reference.model.js";
import type { UserSourceReferences } from "../../ports/user-source-references.js";
import type { ResolveReferenceRoot } from "./resolve-reference-root.use-case.js";

export interface RecordSourceReferenceRequest {
  projectRoot: string;
  marketplace: { readonly name: string; readonly scope: Scope };
}

export interface RecordSourceReferenceDeps {
  readonly resolveReferenceRoot: ResolveReferenceRoot;
  readonly currentVersion: string;
  readonly frameworkMarketplaceName: string;
  readonly userSourceReferences?: UserSourceReferences;
}

/** Records that a project references the shared machine-scope framework source, when that is what
 * was registered. Absent registry skips recording rather than guessing one. */
export class RecordSourceReference {
  constructor(private readonly deps: RecordSourceReferenceDeps) {}

  // Written every time this runs, not only the first: another project on this machine may have
  // registered the shared source before this one did, leaving this project's reference missing.
  async execute(command: RecordSourceReferenceRequest): Promise<void> {
    // The same name-and-scope predicate `sync` and `clean` apply before touching
    // `references.json`: always true today, but a future change must not silently start writing a
    // reference for a registration that is no longer the shared one.
    const { name, scope } = command.marketplace;
    const { resolveReferenceRoot, currentVersion, frameworkMarketplaceName, userSourceReferences } =
      this.deps;
    if (!frameworkSourceIsShared(name, scope, frameworkMarketplaceName)) return;
    if (userSourceReferences === undefined) return;
    const resolvedRoot = await resolveReferenceRoot.execute(command.projectRoot);
    await userSourceReferences.addReference(currentVersion, resolvedRoot);
  }
}
