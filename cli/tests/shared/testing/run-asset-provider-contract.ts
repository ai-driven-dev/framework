import { describe, expect, it } from "vitest";
import type { ConfigAsset } from "../../../src/shared/domain/file.js";
import type { AssetProvider } from "../../../src/shared/ports/asset-provider.js";

/** One implementation of the asset port, with an asset it holds. */
export interface AssetProviderSubject {
  readonly provider: AssetProvider;
  readonly heldAsset: { readonly toolId: string; readonly fileName: string };
}

const MISSING_FILE = "no-such-asset.json";

/** What the asset port promises, stated once and run against every implementation of it. */
export function describeAssetProviderContract(
  subjectName: string,
  makeSubject: () => AssetProviderSubject
) {
  describe(`when the asset provider is ${subjectName}`, () => {
    it("answers the same config asset on every load", () => {
      const { provider, heldAsset } = makeSubject();

      const first: ConfigAsset = provider.loadConfigAsset(heldAsset.toolId, heldAsset.fileName);

      expect(provider.loadConfigAsset(heldAsset.toolId, heldAsset.fileName)).toEqual(first);
    });

    it("throws for a config asset it does not hold", () => {
      const { provider, heldAsset } = makeSubject();

      expect(() => provider.loadConfigAsset(heldAsset.toolId, MISSING_FILE)).toThrow();
    });
  });
}
