import { describe, expect, it } from "vitest";
import {
  assertToolSupportsScope,
  getToolSupportedScope,
} from "../../../../src/contexts/installation/domain/install-scope.js";
import { InvalidPluginScopeError } from "../../../../src/shared/domain/errors.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";

describe("install-scope tool support", () => {
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
      expect(() => assertToolSupportsScope(TOOL.cursor, "user", "user")).not.toThrow();
      expect(() => assertToolSupportsScope(TOOL.claude, "project", "project")).not.toThrow();
    });

    it("throws InvalidPluginScopeError on mismatch", () => {
      expect(() => assertToolSupportsScope(TOOL.cursor, "project", "user")).toThrow(
        InvalidPluginScopeError
      );
      expect(() => assertToolSupportsScope(TOOL.claude, "user", "project")).toThrow(
        InvalidPluginScopeError
      );
    });
  });
});
