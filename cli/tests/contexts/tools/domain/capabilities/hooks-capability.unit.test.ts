import { describe, expect, it } from "vitest";
import { HooksCapability } from "../../../../../src/contexts/tools/domain/capabilities/hooks-capability.js";
import { CapabilityConfigError } from "../../../../../src/kernel/errors.js";

describe("HooksCapability", () => {
  const params = { outputPath: ".codex/hooks.json" };

  describe("buildOutputPath", () => {
    it("returns the configured output path", () => {
      const cap = new HooksCapability(params);
      expect(cap.outputPath()).toBe(".codex/hooks.json");
    });
  });

  describe("accepts", () => {
    it("returns true for the exact output path", () => {
      const cap = new HooksCapability(params);
      expect(cap.accepts(".codex/hooks.json")).toBe(true);
    });

    it("returns false for any other path", () => {
      const cap = new HooksCapability(params);
      expect(cap.accepts(".codex/settings.json")).toBe(false);
    });
  });

  describe("equals", () => {
    it("returns true for identical params", () => {
      const a = new HooksCapability(params);
      const b = new HooksCapability({ ...params });
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when outputPath differs", () => {
      const a = new HooksCapability(params);
      const b = new HooksCapability({ outputPath: ".other/hooks.json" });
      expect(a.equals(b)).toBe(false);
    });
  });
});

describe("HooksCapability declarations", () => {
  it("consumes nothing unless told otherwise", () => {
    expect(new HooksCapability({ outputPath: "h.json" }).consumes("tool-hooks")).toBe(false);
    expect(
      new HooksCapability({ outputPath: "h.json", consumes: ["hooks"] }).consumes("hooks")
    ).toBe(true);
  });

  it("lets the user's file win unless the tool declares otherwise", () => {
    expect(new HooksCapability({ outputPath: "h.json" }).mergeStrategy()).toBe("user-prime");
    expect(
      new HooksCapability({ outputPath: "h.json", mergeStrategy: "none" }).mergeStrategy()
    ).toBe("none");
  });

  it("differs on the merge strategy alone", () => {
    const cap = new HooksCapability({ outputPath: "h.json", mergeStrategy: "none" });

    expect(cap.equals(new HooksCapability({ outputPath: "h.json", mergeStrategy: "none" }))).toBe(
      true
    );
    expect(
      cap.equals(new HooksCapability({ outputPath: "h.json", mergeStrategy: "user-prime" }))
    ).toBe(false);
  });
});

describe("HooksCapability output path", () => {
  it.each(["/etc/hooks.json", "C:\\hooks.json", "\\hooks.json"])(
    "refuses the absolute path %s",
    (outputPath) => {
      expect(() => new HooksCapability({ outputPath })).toThrow(CapabilityConfigError);
    }
  );

  it.each(["../hooks.json", "a/../hooks.json", "a\\..\\hooks.json"])(
    "refuses %s, which leaves the project",
    (outputPath) => {
      expect(() => new HooksCapability({ outputPath })).toThrow(CapabilityConfigError);
    }
  );

  it("keeps a name that merely holds two dots", () => {
    expect(new HooksCapability({ outputPath: ".tool/a..b.json" }).outputPath()).toBe(
      ".tool/a..b.json"
    );
  });
});
