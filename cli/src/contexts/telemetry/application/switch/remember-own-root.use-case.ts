import { RememberedResolutions } from "../../domain/remembered-resolutions.js";
import { repositoryIdOf } from "../../domain/repository-identity.js";
import { cwdKey } from "../../domain/repository-resolution.js";
import type { ResolutionEnvironment } from "../../domain/resolution/resolution-run.js";
import type { ResolutionStore } from "../../ports/resolution-store.js";
import type { UsageLedger } from "../../ports/usage-ledger.js";
import type { Located } from "./clone-consent.js";

/** Remembers the root `on` ran in, seen alive in its clone, so a declaration made there is
 * known to belong to a repository `forget` can find, though no session ever ran there. A
 * repository with neither a remote nor a commit has nothing to be named by, and a clone the
 * platform cannot identify cannot be remembered: neither is. It runs under the ledger's lock,
 * which every writer of `roots.json` holds. */
export class RememberOwnRoot {
  constructor(
    private readonly ledger: UsageLedger,
    private readonly resolutions: ResolutionStore,
    private readonly environment: ResolutionEnvironment
  ) {}

  execute(located: Located): Promise<void> {
    return this.ledger.exclusively(async () => {
      const repositoryId = repositoryIdOf(located);
      if (repositoryId === null || located.clone === null) return;
      const { remembered } = new RememberedResolutions(await this.resolutions.load()).remember({
        dir: cwdKey(located.root, this.environment.caseInsensitiveFileSystem),
        repositoryId,
        root: located.root,
        clone: located.clone,
        at: this.environment.now().toISOString(),
      });
      if (remembered.changed) await this.resolutions.save(remembered.sightings);
    });
  }
}
