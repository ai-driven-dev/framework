import { describe, expect, it } from "vitest";
import { MarketplaceEntryAlreadyExistsError } from "../../../src/domain/errors.js";
import { appendPluginToMarketplace } from "../../../src/domain/formats/marketplace-json.js";

const ENTRY = {
  name: "my-plugin",
  version: "0.1.0",
  source: "./my-plugin",
  description: "A plugin",
  recommended: false,
  strict: true,
};

describe("appendPluginToMarketplace", () => {
  it("appends entry to empty plugins array", () => {
    const result = appendPluginToMarketplace(JSON.stringify({ plugins: [] }), ENTRY);
    const parsed = JSON.parse(result) as { plugins: unknown[] };
    expect(parsed.plugins).toHaveLength(1);
    expect(parsed.plugins[0]).toMatchObject({ name: "my-plugin" });
  });

  it("appends entry when plugins key is absent", () => {
    const result = appendPluginToMarketplace(JSON.stringify({}), ENTRY);
    const parsed = JSON.parse(result) as { plugins: unknown[] };
    expect(parsed.plugins).toHaveLength(1);
  });

  it("appends to existing plugins", () => {
    const existing = {
      plugins: [
        {
          name: "other",
          version: "1.0.0",
          source: ".",
          description: "",
          recommended: false,
          strict: false,
        },
      ],
    };
    const result = appendPluginToMarketplace(JSON.stringify(existing), ENTRY);
    const parsed = JSON.parse(result) as { plugins: unknown[] };
    expect(parsed.plugins).toHaveLength(2);
  });

  it("throws MarketplaceEntryAlreadyExistsError on name collision", () => {
    const existing = { plugins: [ENTRY] };
    expect(() => appendPluginToMarketplace(JSON.stringify(existing), ENTRY)).toThrow(
      MarketplaceEntryAlreadyExistsError
    );
  });

  it("preserves other keys in the JSON object", () => {
    const json = JSON.stringify({ name: "my-market", url: "https://example.com", plugins: [] });
    const result = appendPluginToMarketplace(json, ENTRY);
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.name).toBe("my-market");
    expect(parsed.url).toBe("https://example.com");
  });

  it("output is pretty-printed with trailing newline", () => {
    const result = appendPluginToMarketplace(JSON.stringify({ plugins: [] }), ENTRY);
    expect(result.endsWith("\n")).toBe(true);
    expect(result).toContain("  ");
  });
});
