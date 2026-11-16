import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { VersionReader } from "../../../shared/ports/version-reader.js";
import type { UserSourceReferences } from "../ports/user-source-references.js";
import {
  frameworkSourceIsShared,
  resolveProjectRootForReferences,
  toleratingUnreadableSourceReferences,
} from "./shared-source-reference-support.js";

export interface RecordSourceReferenceCommand {
  projectRoot: string;
  marketplace: { readonly name: string; readonly scope: MarketplaceScope };
}

/** Records that a project references the shared machine-scope framework source, when that is what
 * was registered. Absent registry skips recording rather than guessing one. */
export class RecordSourceReference {
  constructor(
    private readonly fs: FileReader,
    private readonly currentVersionProvider: VersionReader,
    private readonly logger: Logger,
    private readonly frameworkMarketplaceName: string,
    private readonly userSourceReferences?: UserSourceReferences
  ) {}

  // Written every time this runs, not only the first: another project on this machine may have
  // registered the shared source before this one did, leaving this project's reference missing.
  async execute(command: RecordSourceReferenceCommand): Promise<void> {
    // The same name-and-scope predicate `sync` and `clean` apply before touching
    // `references.json`: always true today, but a future change must not silently start writing a
    // reference for a registration that is no longer the shared one.
    const { name, scope } = command.marketplace;
    if (!frameworkSourceIsShared(name, scope, this.frameworkMarketplaceName)) return;
    if (this.userSourceReferences === undefined) return;
    const userSourceReferences = this.userSourceReferences;
    await toleratingUnreadableSourceReferences(this.logger, undefined, async () => {
      const resolvedRoot = await resolveProjectRootForReferences(this.fs, command.projectRoot);
      await userSourceReferences.addReference(this.currentVersionProvider.get(), resolvedRoot);
    });
  }
}
