import { describe, expect, it } from "vitest";
import { isScope, parseScope } from "../../../src/shared/domain/scope.js";

describe("scope value object", () => {
  describe("isScope", () => {
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

  describe("parseScope", () => {
    it("returns undefined for undefined input", () => {
      expect(parseScope(undefined)).toBeUndefined();
    });

    it("returns the scope when valid", () => {
      expect(parseScope("project")).toBe("project");
      expect(parseScope("user")).toBe("user");
    });

    it("throws on invalid value", () => {
      expect(() => parseScope("global")).toThrow(/Invalid scope/);
    });
  });
});
