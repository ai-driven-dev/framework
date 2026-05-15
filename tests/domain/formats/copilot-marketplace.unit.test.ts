import { describe, expect, it } from "vitest";
import { ForeignSchemaValidationError } from "../../../src/domain/errors.js";
import { parseCopilotMarketplace } from "../../../src/domain/formats/copilot-marketplace.js";

const VALID_JSON = JSON.stringify({
  name: "copilot-dev-tools",
  description: "Developer tools for Copilot",
  version: "2.0.0",
  author: { name: "Copilot Community" },
  repository: "https://github.com/example/copilot-dev-tools",
  license: "MIT",
  keywords: ["copilot", "dev-tools"],
  agents: ["./agents"],
  skills: ["./skills/debug"],
});

describe("parseCopilotMarketplace", () => {
  describe("happy path", () => {
    it("returns a NormalizedCatalog with source copilot", () => {
      const catalog = parseCopilotMarketplace(VALID_JSON);
      expect(catalog.source).toBe("copilot");
    });

    it("returns exactly one plugin entry (single-manifest convention)", () => {
      const catalog = parseCopilotMarketplace(VALID_JSON);
      expect(catalog.plugins).toHaveLength(1);
    });

    it("parses name from manifest", () => {
      const catalog = parseCopilotMarketplace(VALID_JSON);
      expect(catalog.plugins[0].name).toBe("copilot-dev-tools");
    });

    it("parses optional version when present", () => {
      const catalog = parseCopilotMarketplace(VALID_JSON);
      expect(catalog.plugins[0].version).toBe("2.0.0");
    });

    it("parses optional description when present", () => {
      const catalog = parseCopilotMarketplace(VALID_JSON);
      expect(catalog.plugins[0].description).toBe("Developer tools for Copilot");
    });

    it("omits version when absent", () => {
      const raw = JSON.stringify({ name: "copilot-testing", description: "Testing utilities" });
      const catalog = parseCopilotMarketplace(raw);
      expect(catalog.plugins[0].version).toBeUndefined();
    });

    it("omits description when absent", () => {
      const raw = JSON.stringify({ name: "copilot-minimal" });
      const catalog = parseCopilotMarketplace(raw);
      expect(catalog.plugins[0].description).toBeUndefined();
    });

    it("ignores unknown fields like author, repository, license, keywords, agents, skills", () => {
      expect(() => parseCopilotMarketplace(VALID_JSON)).not.toThrow();
      const catalog = parseCopilotMarketplace(VALID_JSON);
      expect(catalog.plugins[0].name).toBe("copilot-dev-tools");
    });

    it("sets source to copilot on the plugin entry", () => {
      const catalog = parseCopilotMarketplace(VALID_JSON);
      expect(catalog.plugins[0].source).toBe("copilot");
    });
  });

  describe("malformed JSON", () => {
    it("throws ForeignSchemaValidationError for invalid JSON string", () => {
      expect(() => parseCopilotMarketplace("{ not valid json")).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("error message includes source copilot", () => {
      try {
        parseCopilotMarketplace("bad");
      } catch (err) {
        expect(err instanceof ForeignSchemaValidationError).toBe(true);
        expect((err as Error).message).toContain("copilot");
      }
    });
  });

  describe("invalid root shape", () => {
    it("throws when root is an array not object", () => {
      expect(() => parseCopilotMarketplace(JSON.stringify([]))).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("throws when root is null", () => {
      expect(() => parseCopilotMarketplace("null")).toThrow(ForeignSchemaValidationError);
    });

    it("throws when root is a string", () => {
      expect(() => parseCopilotMarketplace(JSON.stringify("hello"))).toThrow(
        ForeignSchemaValidationError
      );
    });
  });

  describe("invalid name field", () => {
    it("throws when name is missing", () => {
      expect(() => parseCopilotMarketplace(JSON.stringify({ version: "1.0.0" }))).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("throws when name is empty string", () => {
      expect(() => parseCopilotMarketplace(JSON.stringify({ name: "" }))).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("throws when name is not a string", () => {
      expect(() => parseCopilotMarketplace(JSON.stringify({ name: 42 }))).toThrow(
        ForeignSchemaValidationError
      );
    });

    it("error message mentions name field", () => {
      try {
        parseCopilotMarketplace(JSON.stringify({}));
      } catch (err) {
        expect((err as Error).message).toContain("name");
      }
    });
  });
});
