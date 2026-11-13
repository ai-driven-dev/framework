import { describe, expect, it } from "vitest";
import {
  assertToolSupportsScope,
  getToolSupportedScope,
  isInstallScope,
  parseInstallScope,
} from "../../../../src/contexts/framework/domain/install-scope.js";
import { InvalidPluginScopeError } from "../../../../src/shared/domain/errors.js";

describe("install-scope value object", () => {
  describe("isInstallScope", () => {
    it("returns true for project and user", () => {
      expect(isInstallScope("project")).toBe(true);
      expect(isInstallScope("user")).toBe(true);
    });

    it("returns false for any other string", () => {
      expect(isInstallScope("global")).toBe(false);
      expect(isInstallScope("")).toBe(false);
      expect(isInstallScope(undefined)).toBe(false);
    });
  });

  describe("parseInstallScope", () => {
    it("returns undefined for undefined input", () => {
      expect(parseInstallScope(undefined)).toBeUndefined();
    });

    it("returns the scope when valid", () => {
      expect(parseInstallScope("project")).toBe("project");
      expect(parseInstallScope("user")).toBe("user");
    });

    it("throws on invalid value", () => {
      expect(() => parseInstallScope("global")).toThrow(/Invalid scope/);
    });
  });

  describe("getToolSupportedScope", () => {
    it("answers user for a tool that requires the user scope", () => {
      expect(getToolSupportedScope(true)).toBe("user");
    });

    it("answers project for a tool that does not", () => {
      expect(getToolSupportedScope(false)).toBe("project");
    });
  });

  describe("assertToolSupportsScope", () => {
    it("does not throw when the requested scope is the supported one", () => {
      expect(() => assertToolSupportsScope("cursor", "user", "user")).not.toThrow();
      expect(() => assertToolSupportsScope("claude", "project", "project")).not.toThrow();
    });

    it("throws InvalidPluginScopeError on mismatch", () => {
      expect(() => assertToolSupportsScope("cursor", "project", "user")).toThrow(
        InvalidPluginScopeError
      );
      expect(() => assertToolSupportsScope("claude", "user", "project")).toThrow(
        InvalidPluginScopeError
      );
    });
  });
});
