import type { MarketplaceScope } from "../../../shared/domain/scope.js";
import type { PluginSourceGitHub, PluginSourceLocal } from "../../../shared/domain/source.js";

export const DEFAULT_FRAMEWORK_REPO = "ai-driven-dev/framework";

/** Where the framework marketplace comes from: a repository (`repo`, optionally at a `ref`) or a
 * directory (`path`). The same two shapes a plugin source takes, so a registration records it
 * as it stands. */
export type FrameworkSource = PluginSourceGitHub | PluginSourceLocal;

/** A repository source, the framework's own when none is named, at `ref` or at its tip. */
export function remoteFrameworkSource(repo?: string, ref?: string): PluginSourceGitHub {
  return { kind: "github", repo: repo ?? DEFAULT_FRAMEWORK_REPO, ref };
}

/** A directory source. */
export function localFrameworkSource(path: string): PluginSourceLocal {
  return { kind: "local", path };
}

/** The framework marketplace as registered: its name and the scope it ended up at. */
export interface EnsuredFrameworkMarketplace {
  readonly name: string;
  readonly scope: MarketplaceScope;
}
