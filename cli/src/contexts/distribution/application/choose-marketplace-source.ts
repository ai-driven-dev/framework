import { resolve } from "node:path";
import type { FrameworkSource } from "../contract/framework-source.js";
import { MarketplaceSourceMode } from "../domain/marketplace-source-mode.js";
import type { ReleaseLister } from "../ports/release-lister.js";

/** What setup needs to settle where the framework marketplace comes from, without asking anyone:
 * the sources a choice can name, the releases to choose from, and the default a run with no one to
 * ask takes. The question itself is orchestration's. */
export class ChooseMarketplaceSource {
  constructor(private readonly releaseResolver: ReleaseLister) {}

  /** A repository source, the framework's own when none is named, at `ref` or at its tip. */
  remote(repo?: string, ref?: string): FrameworkSource {
    return MarketplaceSourceMode.remote(repo, ref);
  }

  /** A directory source, its path made absolute. */
  local(path: string): FrameworkSource {
    return MarketplaceSourceMode.local(resolve(path));
  }

  /** The root releases of `repo`, newest first. */
  releases(repo: string): Promise<readonly string[]> {
    return this.releaseResolver.listRootReleases(repo);
  }

  /** A repository source naming no release takes the newest one, or its tip when none exists. Any
   * other source is already settled. */
  async pinNewest(source: FrameworkSource): Promise<FrameworkSource> {
    if (source.kind !== "remote" || source.ref !== undefined) return source;
    const [newest] = await this.releases(source.repo);
    return this.remote(source.repo, newest);
  }
}
