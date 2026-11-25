import { describe, expect, it } from "vitest";
import { getToolSupportedScope, isScope, parseScope } from "../../../src/shared/domain/scope.js";
import { saying } from "../testing/saying.builder.js";

describe("scope value object", () => {
  describe("telling whether a string is a scope", () => {
    it("returns true for project and user", () => {
      expect(isScope("project")).toBe(true);
      expect(isScope("user")).toBe(true);
    });

    it("returns false for any other string", () => {
      expect(isScope("global")).toBe(false);
      expect(isScope("")).toBe(false);
      expect(isScope(undefined)).toBe(false);
    });
  });

  describe("reading a scope", () => {
    it("returns undefined for undefined input", () => {
      expect(parseScope(undefined)).toBeUndefined();
    });

    it("returns the scope when valid", () => {
      expect(parseScope("project")).toBe("project");
      expect(parseScope("user")).toBe("user");
    });

    it("throws on invalid value", () => {
      expect(() => parseScope("global")).toThrow(saying(/Invalid scope/));
    });
  });

  describe("choosing the scope a tool supports", () => {
    it("answers user for a tool that requires the user scope", () => {
      expect(getToolSupportedScope(true)).toBe("user");
    });

    it("answers project for a tool that does not", () => {
      expect(getToolSupportedScope(false)).toBe("project");
    });
  });
});
