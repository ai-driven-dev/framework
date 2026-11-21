import { type FrameworkSource, remoteFrameworkSource } from "../contract/framework-source.js";
import type { ListFrameworkReleases } from "./list-framework-releases.use-case.js";

/** A repository source naming no release takes the newest one, or its tip when none exists. Any
 * other source is already settled. */
export class PinNewestFrameworkSource {
  constructor(private readonly releases: Pick<ListFrameworkReleases, "execute">) {}

  async execute(source: FrameworkSource): Promise<FrameworkSource> {
    if (source.kind !== "github" || source.ref !== undefined) return source;
    const [newest] = await this.releases.execute(source.repo);
    return remoteFrameworkSource(source.repo, newest);
  }
}
