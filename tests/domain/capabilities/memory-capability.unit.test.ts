import { describe, expect, it } from "vitest";
import { MemoryCapability } from "../../../src/domain/capabilities/memory-capability.js";

const stubRewrite = (content: string): string => content;

describe("MemoryCapability", () => {
  const params = { outputFileName: "AGENTS.md", rewriteContent: stubRewrite };

  describe("buildOutputPath", () => {
    it("returns the configured output file name", () => {
      const cap = new MemoryCapability(params);
      expect(cap.buildOutputPath()).toBe("AGENTS.md");
    });
  });

  describe("buildInstallPath", () => {
    it("returns outputFileName for the agentsMd template", () => {
      const cap = new MemoryCapability(params);
      expect(cap.buildInstallPath("agentsMd")).toBe("AGENTS.md");
    });

    it("returns null for unknown template names", () => {
      const cap = new MemoryCapability(params);
      expect(cap.buildInstallPath("other")).toBeNull();
    });
  });

  describe("accepts", () => {
    it("returns true when path ends with outputFileName", () => {
      const cap = new MemoryCapability(params);
      expect(cap.accepts("AGENTS.md")).toBe(true);
    });

    it("returns true when path is nested and ends with outputFileName", () => {
      const cap = new MemoryCapability(params);
      expect(cap.accepts("some/path/AGENTS.md")).toBe(true);
    });

    it("returns false when path does not end with outputFileName", () => {
      const cap = new MemoryCapability(params);
      expect(cap.accepts("CLAUDE.md")).toBe(false);
    });
  });

  describe("equals", () => {
    it("returns true for identical params", () => {
      const a = new MemoryCapability(params);
      const b = new MemoryCapability({ ...params });
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when outputFileName differs", () => {
      const a = new MemoryCapability(params);
      const b = new MemoryCapability({ outputFileName: "CLAUDE.md", rewriteContent: stubRewrite });
      expect(a.equals(b)).toBe(false);
    });
  });
});
