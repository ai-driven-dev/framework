import { describe, expect, it } from "vitest";
import { ForeignSchemaValidationError } from "../../../src/domain/errors.js";
import { parseCodexMarketplace } from "../../../src/domain/formats/codex-marketplace.js";

const VALID_JSON = JSON.stringify({
  name: "local-example-plugins",
  plugins: [
    {
      name: "codex-dev-tools",
      version: "1.2.0",
      description: "Developer tools for Codex",
      author: { name: "Codex Community" },
      skills: "./skills/",
      mcpServers: "./.mcp.json",
    },
  ],
});

describe("parseCodexMarketplace", () => {
  describe("happy path", () => {
    it("returns a NormalizedCatalog with source codex", () => {
      const catalog = parseCodexMarketplace(VALID_JSON);
      expect(catalog.source).toBe("codex");
    });

    it("parses name from first plugin entry", () => {
      const catalog = parseCodexMarketplace(VALID_JSON);
      expect(catalog.plugins[0].name).toBe("codex-dev-tools");
    });

    it("parses optional version when present", () => {
      const catalog = parseCodexMarketplace(VALID_JSON);
      expect(catalog.plugins[0].version).toBe("1.2.0");
    });

    it("parses optional description when present", () => {
      const catalog = parseCodexMarketplace(VALID_JSON);
      expect(catalog.plugins[0].description).toBe("Developer tools for Codex");
    });

    it("returns multiple plugin entries from plugins array", () => {
      const raw = JSON.stringify({
        plugins: [
          { name: "codex-a", version: "1.0.0", description: "First" },
          { name: "codex-b", description: "Second" },
          { name: "codex-c" },
        ],
      });
      const catalog = parseCodexMarketplace(raw);
      expect(catalog.plugins).toHaveLength(3);
    });

    it("omits version when absent", () => {
      const raw = JSON.stringify({ plugins: [{ name: "codex-testing", description: "Testing" }] });
      const catalog = parseCodexMarketplace(raw);
      expect(catalog.plugins[0].version).toBeUndefined();
    });

    it("omits description when absent", () => {
      const raw = JSON.stringify({ plugins: [{ name: "codex-minimal" }] });
      const catalog = parseCodexMarketplace(raw);
      expect(catalog.plugins[0].description).toBeUndefined();
    });

    it("returns empty array for empty plugins list", () => {
      const raw = JSON.stringify({ plugins: [] });
      const catalog = parseCodexMarketplace(raw);
      expect(catalog.plugins).toHaveLength(0);
    });

    it("ignores unknown fields like author, skills, mcpServers, interface", () => {
      expect(() => parseCodexMarketplace(VALID_JSON)).not.toThrow();
      const catalog = parseCodexMarketplace(VALID_JSON);
      expect(catalog.plugins[0].name).toBe("codex-dev-tools");
    });

    it("sets source to codex on each plugin entry", () => {
      const raw = JSON.stringify({ plugins: [{ name: "codex-a" }, { name: "codex-b" }] });
      const catalog = parseCodexMarketplace(raw);
      expect(catalog.plugins[0].source).toBe("codex");
      expect(catalog.plugins[1].source).toBe("codex");
    });

    it("ignores top-level name field (catalog metadata only)", () => {
      const raw = JSON.stringify({ name: "my-marketplace", plugins: [{ name: "codex-plugin" }] });
      const catalog = parseCodexMarketplace(raw);
      expect(catalog.plugins).toHaveLength(1);
      expect(catalog.plugins[0].name).toBe("codex-plugin");
    });
  });

  describe("malformed JSON", () => {
    it("throws ForeignSchemaValidationError for invalid JSON string", () => {
      expect(() => parseCodexMarketplace("{ not valid json")).toThrow(ForeignSchemaValidationError);
    });

    it("error message includes source codex", () => {
      try {
        parseCodexMarketplace("bad");
      } catch (err) {
        expect(err instanceof ForeignSchemaValidationError).toBe(true);
        expect((err as Error).message).toContain("codex");
      }
    });
  });

  describe("invalid root shape", () => {
    it("throws when root is an array not object", () => {
      expect(() => parseCodexMarketplace(JSON.stringify([]))).toThrow(ForeignSchemaValidationError);
    });

    it("throws when root is null", () => {
      expect(() => parseCodexMarketplace("null")).toThrow(ForeignSchemaValidationError);
    });

    it("throws when root is a string", () => {
      expect(() => parseCodexMarketplace(JSON.stringify("hello"))).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("throws when plugins field is missing", () => {
      expect(() => parseCodexMarketplace(JSON.stringify({ name: "catalog" }))).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("throws when plugins field is not an array", () => {
      expect(() => parseCodexMarketplace(JSON.stringify({ plugins: "not-array" }))).toThrow(
        ForeignSchemaValidationError
      );
    });
  });

  describe("invalid plugin entry", () => {
    it("throws when a plugin entry is not an object", () => {
      expect(() => parseCodexMarketplace(JSON.stringify({ plugins: ["string-entry"] }))).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("throws when plugin name is missing", () => {
      expect(() =>
        parseCodexMarketplace(JSON.stringify({ plugins: [{ version: "1.0.0" }] }))
      ).toThrow(ForeignSchemaValidationError);
    });

    it("throws when plugin name is empty string", () => {
      expect(() => parseCodexMarketplace(JSON.stringify({ plugins: [{ name: "" }] }))).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("throws when plugin name is not a string", () => {
      expect(() => parseCodexMarketplace(JSON.stringify({ plugins: [{ name: 42 }] }))).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("error message includes index of bad entry", () => {
      try {
        parseCodexMarketplace(JSON.stringify({ plugins: [{ name: "ok" }, { version: "1.0.0" }] }));
      } catch (err) {
        expect((err as Error).message).toContain("plugins[1]");
      }
    });

    it("error message mentions name field", () => {
      try {
        parseCodexMarketplace(JSON.stringify({ plugins: [{}] }));
      } catch (err) {
        expect((err as Error).message).toContain("name");
      }
    });
  });
});
