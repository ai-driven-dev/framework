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

describe("BundledAssetProviderAdapter.loadSchema - marketplace", () => {
  it("returns a Copilot-native schema with required fields including metadata", () => {
    const schema = provider.loadSchema("marketplace");
    expect(schema).toHaveProperty("properties");
    expect(schema).toHaveProperty(
      "required",
      expect.arrayContaining(["name", "metadata", "owner", "plugins"])
    );
  });

  it("requires metadata.pluginRoot in the schema properties", () => {
    const schema = provider.loadSchema("marketplace");
    expect(schema).toHaveProperty("properties.metadata.properties.pluginRoot");
  });

  it("documents the awesome-copilot empirical source in $comment", () => {
    const schema = provider.loadSchema("marketplace");
    expect(schema).toHaveProperty("$comment", expect.stringMatching(/awesome-copilot/i));
  });

  it("returns the same object on a second call (memoized)", () => {
    const first = provider.loadSchema("marketplace");
    const second = provider.loadSchema("marketplace");
    expect(first).toBe(second);
  });
});
