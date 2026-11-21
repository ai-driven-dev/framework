import { UnresolvableUserScopeError } from "../../../../shared/domain/errors/unresolvable-user-scope-error.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";

export interface ScopeBaseQuery {
  readonly scope: Scope;
  readonly projectRoot: string;
  /** A thunk: only a user scope reads it. */
  readonly userBaseDir: () => string | null | undefined;
  readonly toolId: AiToolId;
}

/**
 * The directory a plugin's recorded files are relative to, from the scope the manifest recorded,
 * never from the tool's current profile. A user scope the tool no longer explains throws: falling
 * back to `projectRoot` would resolve a deletion or a drift check against the wrong directory.
 */
export function resolveScopeBase({
  scope,
  projectRoot,
  userBaseDir,
  toolId,
}: ScopeBaseQuery): string {
  if (scope === "project") return projectRoot;
  const dir = userBaseDir();
  if (dir === null || dir === undefined) throw new UnresolvableUserScopeError(toolId);
  return dir;
}
