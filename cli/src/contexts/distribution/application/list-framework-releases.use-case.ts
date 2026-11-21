import type { ReleaseLister } from "../../../shared/ports/release-lister.js";
import { rootReleaseTags } from "../domain/root-release.js";

/** The root releases of a framework repository, newest first. */
export class ListFrameworkReleases {
  constructor(private readonly releaseResolver: ReleaseLister) {}

  async execute(repo: string): Promise<readonly string[]> {
    return rootReleaseTags(await this.releaseResolver.listReleaseTags(repo));
  }
}
