import { describe, expect, it } from "vitest";
import { BundledAssetProviderAdapter } from "../../../src/shared/infrastructure/asset-loader.js";
import { saying } from "../testing/saying.builder.js";
import { SYNTHETIC_TOOL, syntheticCatalog } from "../testing/synthetic-tool-id.builder.js";

const provider = new BundledAssetProviderAdapter(syntheticCatalog());

describe("BundledAssetProviderAdapter.loadConfigAsset", () => {
  it("throws for an unknown file name", () => {
    expect(() => provider.loadConfigAsset(SYNTHETIC_TOOL, "missing.json")).toThrow(
      saying(`Bundled asset not found: '${SYNTHETIC_TOOL}/missing.json'`)
    );
  });
});
