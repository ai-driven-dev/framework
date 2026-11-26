import type { UserSourceReferences } from "../../ports/user-source-references.js";

/** Decrements this project's claim exactly once. The resolved root was captured before `.aidd/`
 * and its local marketplace registry were deleted. */
export function dropSourceClaim(references?: UserSourceReferences) {
  return async (resolvedRoot: string | undefined): Promise<void> => {
    if (references === undefined || resolvedRoot === undefined) return;
    await references.removeReference(resolvedRoot);
  };
}
