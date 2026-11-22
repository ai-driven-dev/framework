import { builtMaterializationDepsOf } from "../../../../src/composition/installation.js";
import type { FlatPlacementDeps } from "../../../../src/contexts/installation/application/materialize/place-flat-plugin.js";
import type { BuiltMaterializationDeps } from "../../../../src/contexts/installation/application/shared/built-materialization-deps.js";
import { TranslateDistribution } from "../../../../src/contexts/translate/application/translate-distribution.use-case.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";
import { fakeEnsureBuiltMarketplace } from "../../../shared/testing/fake-ensure-built-marketplace.fake.js";
import { InMemoryMarketplaceRegistry } from "../../../shared/testing/in-memory-marketplace-registry.fake.js";
import { registeredManifestProbes } from "../../../shared/testing/registered-manifest-probes.builder.js";

/** The real translation: pure, so a test needs no fake of it. */
export const translateDistribution = new TranslateDistribution(registeredManifestProbes());

/** The build and translation sources an AddPlugin reads, both faked or real-and-pure. */
export function fakeBuildSources() {
  return {
    ensureBuilt: fakeEnsureBuiltMarketplace(),
    translate: translateDistribution,
  };
}

/** What a placement reaches for, faked where it touches a host; `parts` fixes what a test cares about. */
export function fakeBuiltDeps(
  fs: FileReader & FileWriter,
  parts: Partial<Omit<BuiltMaterializationDeps, "projectHooks">> = {}
): BuiltMaterializationDeps {
  return builtMaterializationDepsOf(fs, {
    ...fakeBuildSources(),
    marketplaceRegistry: new InMemoryMarketplaceRegistry(),
    platform: process.platform,
    homedir: () => "/stub-home",
    ...parts,
  });
}

/** What a flat placement reaches for, over a test's own filesystem. */
export function fakeFlatDeps(
  fs: FileReader & FileWriter,
  homedir: () => string = () => "/stub-home"
): FlatPlacementDeps {
  const { translate, projectHooks } = fakeBuiltDeps(fs);
  return { fs, homedir, translate, projectHooks };
}
