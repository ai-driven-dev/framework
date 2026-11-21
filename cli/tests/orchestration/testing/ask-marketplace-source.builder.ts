import { ListFrameworkReleases } from "../../../src/contexts/distribution/application/list-framework-releases.js";
import { PinNewestFrameworkSource } from "../../../src/contexts/distribution/application/pin-newest-framework-source.js";
import { AskMarketplaceSource } from "../../../src/orchestration/setup/ask-marketplace-source.js";
import type { Prompter } from "../../../src/shared/ports/prompter.js";
import type { ReleaseLister } from "../../../src/shared/ports/release-lister.js";

/** The source question as composition wires it. */
export function askMarketplaceSource(
  prompter: Prompter,
  releases: ReleaseLister
): AskMarketplaceSource {
  const listReleases = new ListFrameworkReleases(releases);
  return new AskMarketplaceSource(
    prompter,
    listReleases,
    new PinNewestFrameworkSource(listReleases)
  );
}
