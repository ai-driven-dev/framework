import type { BuiltMaterializationDeps } from "../../../src/contexts/installation/application/shared/built-materialization-deps.js";
import { TranslateDistribution } from "../../../src/contexts/translate/application/translate-distribution.js";
import { registeredManifestProbes } from "../../shared/testing/registered-manifest-probes.js";
import { fakeEnsureBuiltMarketplace } from "./fake-ensure-built-marketplace.js";
import { InMemoryMarketplaceRegistry } from "./in-memory-marketplace-registry.js";

/** The real translation: pure, so a test needs no fake of it. */
export const translateDistribution = new TranslateDistribution(registeredManifestProbes());

/** The build and translation sources an AddPlugin reads, both faked or real-and-pure. */
export function fakeBuildSources() {
  return {
    ensureBuilt: fakeEnsureBuiltMarketplace(),
    translate: translateDistribution,
  };
}

/** What re-materializing a plugin reaches for, faked where it touches a host. */
export function fakeBuiltDeps(): BuiltMaterializationDeps {
  return {
    ...fakeBuildSources(),
    marketplaceRegistry: new InMemoryMarketplaceRegistry(),
    platform: process.platform,
    homedir: () => "/stub-home",
  };
}
