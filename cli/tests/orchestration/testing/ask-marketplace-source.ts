import { ChooseMarketplaceSource } from "../../../src/contexts/distribution/application/choose-marketplace-source.js";
import { AskMarketplaceSource } from "../../../src/orchestration/setup/ask-marketplace-source.js";
import type { Prompter } from "../../../src/shared/ports/prompter.js";
import type { ReleaseLister } from "../../../src/shared/ports/release-lister.js";

/** The source question as composition wires it. */
export function askMarketplaceSource(
  prompter: Prompter,
  releases: ReleaseLister
): AskMarketplaceSource {
  return new AskMarketplaceSource(prompter, new ChooseMarketplaceSource(releases));
}
