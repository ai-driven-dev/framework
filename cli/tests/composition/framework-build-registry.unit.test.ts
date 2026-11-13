import { describe, expect, it } from "vitest";
import { wireTools } from "../../src/composition/tools.js";
import { createFrameworkBuildUseCase } from "../../src/composition/translate.js";
import { BundledAssetProviderAdapter } from "../../src/contexts/framework/infrastructure/assets/asset-loader.js";
import type { FrameworkBuildMode } from "../../src/contexts/tools/contract/tool-profile.js";
import {
  buildTargetModesOf,
  type FrameworkBuildTarget,
} from "../../src/contexts/translate/domain/build-target.js";
import { catalogOf } from "../contexts/tools/testing/catalog-of.js";
import { CapturingLogger } from "../helpers/ports/capturing-logger.js";
import { InMemoryFileAdapter } from "../helpers/ports/in-memory-file-adapter.js";

const ALL_TARGETS: readonly FrameworkBuildTarget[] = catalogOf().idsInCanonicalOrder("ai");
const ALL_MODES: readonly FrameworkBuildMode[] = ["marketplace", "flat"];

function makeDeps() {
  return {
    fs: new InMemoryFileAdapter(),
    assetProvider: new BundledAssetProviderAdapter(wireTools()),
    logger: new CapturingLogger(),
  };
}

function isSupported(target: FrameworkBuildTarget, mode: FrameworkBuildMode): boolean {
  return buildTargetModesOf(catalogOf()).some((e) => e.target === target && e.mode === mode);
}

/**
 * Both the wiring and the domain read the pairs off the profiles and cannot disagree on which
 * exist; what is worth running is that each resolves to a use case the wiring can construct.
 */
describe("every announced build target/mode resolves to a wired use case", () => {
  for (const target of ALL_TARGETS) {
    for (const mode of ALL_MODES) {
      const label = `${target}:${mode}`;
      const expected = isSupported(target, mode);

      it(`${label} is ${expected ? "" : "NOT "}wired in the registry, matching the domain list`, () => {
        const useCase = createFrameworkBuildUseCase(catalogOf(), makeDeps(), {
          target,
          mode,
          outDir: "/out",
          force: false,
        });
        expect(useCase !== undefined).toBe(expected);
      });
    }
  }
});

it("resolves a build target the catalog does not know to no use case", () => {
  const ctx = { target: "not-a-tool", mode: "flat", outDir: "/out", force: false } as const;

  expect(createFrameworkBuildUseCase(catalogOf(), makeDeps(), ctx)).toBeUndefined();
});
