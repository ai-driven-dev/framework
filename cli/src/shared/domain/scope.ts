import { InvalidInstallScopeError } from "./shared.error.js";

/** Where a registration lives: bound to one project, or to the user across all of them.
 * Shared vocabulary because a tool's plugin CLI is driven with a scope and must name it
 * without importing the context that fetches content. */
export type Scope = "project" | "user";

const VALID_SCOPES: ReadonlySet<unknown> = new Set<Scope>(["project", "user"]);

export function isScope(value: unknown): value is Scope {
  return VALID_SCOPES.has(value);
}

export function parseScope(value: string | undefined): Scope | undefined {
  if (value === undefined) return undefined;
  if (!isScope(value)) {
    throw new InvalidInstallScopeError(value);
  }
  return value;
}

/** The one scope a tool's plugins install under: the user's when its profile requires it. */
export function getToolSupportedScope(requiresUserScope: boolean): Scope {
  return requiresUserScope ? "user" : "project";
}
