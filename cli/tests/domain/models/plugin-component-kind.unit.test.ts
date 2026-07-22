import { describe, expect, it } from "vitest";
import { InvalidPluginComponentKindError } from "../../../src/domain/errors.js";
import { parsePluginComponentKind } from "../../../src/domain/models/plugin-component-kind.js";

describe("parsePluginComponentKind", () => {
  it("accepts all valid kinds", () => {
    const kinds = ["skills", "agents", "hooks", "mcp", "full"] as const;
    for (const kind of kinds) {
      expect(parsePluginComponentKind(kind)).toBe(kind);
    }
  });

  it("throws InvalidPluginComponentKindError for unknown string", () => {
    expect(() => parsePluginComponentKind("unknown")).toThrow(InvalidPluginComponentKindError);
  });

  it("throws InvalidPluginComponentKindError for empty string", () => {
    expect(() => parsePluginComponentKind("")).toThrow(InvalidPluginComponentKindError);
  });

  it("throws for uppercase variant", () => {
    expect(() => parsePluginComponentKind("Full")).toThrow(InvalidPluginComponentKindError);
  });
});
