import { ChooseMarketplaceSource } from "../../src/contexts/distribution/application/choose-marketplace-source.js";
import type { ReleaseLister } from "../../src/contexts/distribution/ports/release-lister.js";
import { AskMarketplaceSource } from "../../src/orchestration/setup/ask-marketplace-source.js";
import type { Prompter } from "../../src/shared/ports/prompter.js";

/** The source question as composition wires it. */
export function askMarketplaceSource(
  prompter: Prompter,
  releases: ReleaseLister
): AskMarketplaceSource {
  return new AskMarketplaceSource(prompter, new ChooseMarketplaceSource(releases));
}
