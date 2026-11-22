import type { BuiltMaterializationDeps } from "../../../../src/contexts/installation/application/shared/built-materialization-deps.js";
import { TranslateDistribution } from "../../../../src/contexts/translate/application/translate-distribution.use-case.js";
import { fakeEnsureBuiltMarketplace } from "../../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../../shared/testing/in-memory-marketplace-registry.fake.js";
import { registeredManifestProbes } from "../../../shared/testing/registered-manifest-probes.builder.js";
import { builtDepsOf } from "./built-translators.builder.js";

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
export function fakeBuiltDeps(
  fs: InMemoryFileAdapter = new InMemoryFileAdapter()
): BuiltMaterializationDeps {
  return builtDepsOf(fs, {
    ...fakeBuildSources(),
    marketplaceRegistry: new InMemoryMarketplaceRegistry(),
    platform: process.platform,
    homedir: () => "/stub-home",
  });
}
