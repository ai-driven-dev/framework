import { TranslatePluginDistribution } from "../../../src/contexts/translate/application/translate-distribution.js";
import { fakeEnsureBuiltMarketplace } from "./fake-ensure-built-marketplace.js";

/** The build and translation sources an AddPlugin reads, both faked or real-and-pure. */
export function fakeBuildSources() {
  return {
    ensureBuilt: fakeEnsureBuiltMarketplace(),
    translate: new TranslatePluginDistribution(),
  };
}
