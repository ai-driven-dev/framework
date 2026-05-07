import { describe, expect, it } from "vitest";
import { ForeignSchemaValidationError } from "../../../src/domain/errors.js";
import { parseCursorMarketplace } from "../../../src/domain/formats/cursor-marketplace.js";

const VALID_JSON = JSON.stringify({
  plugins: [
    { name: "cursor-dev-tools", version: "1.2.0", description: "Developer tools for Cursor" },
    { name: "cursor-testing", description: "Testing utilities" },
    { name: "cursor-minimal" },
  ],
});

describe("parseCursorMarketplace", () => {
  describe("happy path", () => {
    it("returns a NormalizedCatalog with source cursor", () => {
      const catalog = parseCursorMarketplace(VALID_JSON);
      expect(catalog.source).toBe("cursor");
    });

    it("parses all plugin entries", () => {
      const catalog = parseCursorMarketplace(VALID_JSON);
      expect(catalog.plugins).toHaveLength(3);
    });

    it("parses name on every entry", () => {
      const catalog = parseCursorMarketplace(VALID_JSON);
      expect(catalog.plugins[0].name).toBe("cursor-dev-tools");
      expect(catalog.plugins[1].name).toBe("cursor-testing");
      expect(catalog.plugins[2].name).toBe("cursor-minimal");
    });

    it("parses optional version when present", () => {
      const catalog = parseCursorMarketplace(VALID_JSON);
      expect(catalog.plugins[0].version).toBe("1.2.0");
    });

    it("omits version when absent", () => {
      const catalog = parseCursorMarketplace(VALID_JSON);
      expect(catalog.plugins[1].version).toBeUndefined();
      expect(catalog.plugins[2].version).toBeUndefined();
    });

    it("parses optional description when present", () => {
      const catalog = parseCursorMarketplace(VALID_JSON);
      expect(catalog.plugins[0].description).toBe("Developer tools for Cursor");
      expect(catalog.plugins[1].description).toBe("Testing utilities");
    });

    it("omits description when absent", () => {
      const catalog = parseCursorMarketplace(VALID_JSON);
      expect(catalog.plugins[2].description).toBeUndefined();
    });

    it("returns empty plugins array for empty catalog", () => {
      const catalog = parseCursorMarketplace(JSON.stringify({ plugins: [] }));
      expect(catalog.plugins).toHaveLength(0);
    });

    it("ignores unknown fields on plugin entries", () => {
      const raw = JSON.stringify({
        plugins: [{ name: "x", unknownField: "ignored", anotherUnknown: 42 }],
      });
      expect(() => parseCursorMarketplace(raw)).not.toThrow();
      const catalog = parseCursorMarketplace(raw);
      expect(catalog.plugins[0].name).toBe("x");
    });

    it("ignores unknown top-level fields", () => {
      const raw = JSON.stringify({ plugins: [], unknownTopLevel: true });
      expect(() => parseCursorMarketplace(raw)).not.toThrow();
    });
  });

  describe("malformed JSON", () => {
    it("throws ForeignSchemaValidationError for invalid JSON string", () => {
      expect(() => parseCursorMarketplace("{ not valid json")).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("error message includes source cursor", () => {
      try {
        parseCursorMarketplace("bad");
      } catch (err) {
        expect(err instanceof ForeignSchemaValidationError).toBe(true);
        expect((err as Error).message).toContain("cursor");
      }
    });
  });

  describe("missing or invalid plugins field", () => {
    it("throws when plugins is not an array", () => {
      expect(() => parseCursorMarketplace(JSON.stringify({ plugins: "oops" }))).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("throws when plugins is missing", () => {
      expect(() => parseCursorMarketplace(JSON.stringify({}))).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("throws when root is an array not object", () => {
      expect(() => parseCursorMarketplace(JSON.stringify([]))).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("throws when root is null", () => {
      expect(() => parseCursorMarketplace("null")).toThrow(ForeignSchemaValidationError);
    });
  });

  describe("invalid plugin entries", () => {
    it("throws when a plugin entry is not an object", () => {
      expect(() =>
        parseCursorMarketplace(JSON.stringify({ plugins: ["not-an-object"] }))
      ).toThrow(ForeignSchemaValidationError);
    });

    it("throws when plugin name is missing", () => {
      expect(() =>
        parseCursorMarketplace(JSON.stringify({ plugins: [{ version: "1.0.0" }] }))
      ).toThrow(ForeignSchemaValidationError);
    });

    it("throws when plugin name is empty string", () => {
      expect(() =>
        parseCursorMarketplace(JSON.stringify({ plugins: [{ name: "" }] }))
      ).toThrow(ForeignSchemaValidationError);
    });

    it("error message includes entry index", () => {
      try {
        parseCursorMarketplace(JSON.stringify({ plugins: [{ name: "ok" }, { version: "1.0.0" }] }));
      } catch (err) {
        expect((err as Error).message).toContain("plugins[1]");
      }
    });
  });
});
