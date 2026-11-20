import type { Logger } from "../../../shared/ports/logger.js";
import type { UserSourceReferences } from "../ports/user-source-references.js";
import { toleratingUnreadableSourceReferences } from "./shared-source-reference-support.js";

/** Decrements this project's claim exactly once. The resolved root was captured before `.aidd/`
 * and its local marketplace registry were deleted. */
export function dropSourceClaim(logger: Logger, references?: UserSourceReferences) {
  return async (resolvedRoot: string | undefined): Promise<void> => {
    if (references === undefined || resolvedRoot === undefined) return;
    await toleratingUnreadableSourceReferences(logger, undefined, () =>
      references.removeReference(resolvedRoot)
    );
  };
}
