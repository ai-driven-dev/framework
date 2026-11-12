import { describe, expect, it } from "vitest";
import { HooksSection } from "../../../../../src/contexts/tools/domain/sections/hooks-section.js";
import { CapabilityConfigError } from "../../../../../src/kernel/errors.js";

describe("HooksSection", () => {
  const params = { outputPath: ".codex/hooks.json" };

  describe("outputPath", () => {
    it("returns the configured output path", () => {
      const cap = new HooksSection(params);
      expect(cap.outputPath()).toBe(".codex/hooks.json");
    });
  });

  describe("accepts", () => {
    it("returns true for the exact output path", () => {
      const cap = new HooksSection(params);
      expect(cap.accepts(".codex/hooks.json")).toBe(true);
    });

    it("returns false for any other path", () => {
      const cap = new HooksSection(params);
      expect(cap.accepts(".codex/settings.json")).toBe(false);
    });
  });

  describe("equals", () => {
    it("returns true for identical params", () => {
      const a = new HooksSection(params);
      const b = new HooksSection({ ...params });
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when outputPath differs", () => {
      const a = new HooksSection(params);
      const b = new HooksSection({ outputPath: ".other/hooks.json" });
      expect(a.equals(b)).toBe(false);
    });
  });
});

describe("HooksSection declarations", () => {
  it("consumes nothing unless told otherwise", () => {
    expect(new HooksSection({ outputPath: "h.json" }).consumes("tool-hooks")).toBe(false);
    expect(new HooksSection({ outputPath: "h.json", consumes: ["hooks"] }).consumes("hooks")).toBe(
      true
    );
  });

  it("lets the user's file win unless the tool declares otherwise", () => {
    expect(new HooksSection({ outputPath: "h.json" }).mergeStrategy()).toBe("user-prime");
    expect(new HooksSection({ outputPath: "h.json", mergeStrategy: "none" }).mergeStrategy()).toBe(
      "none"
    );
  });

  it("differs on the merge strategy alone", () => {
    const cap = new HooksSection({ outputPath: "h.json", mergeStrategy: "none" });

    expect(cap.equals(new HooksSection({ outputPath: "h.json", mergeStrategy: "none" }))).toBe(
      true
    );
    expect(
      cap.equals(new HooksSection({ outputPath: "h.json", mergeStrategy: "user-prime" }))
    ).toBe(false);
  });
});

describe("HooksSection output path", () => {
  it.each(["/etc/hooks.json", "C:\\hooks.json", "\\hooks.json"])(
    "refuses the absolute path %s",
    (outputPath) => {
      expect(() => new HooksSection({ outputPath })).toThrow(CapabilityConfigError);
    }
  );

  it.each(["../hooks.json", "a/../hooks.json", "a\\..\\hooks.json"])(
    "refuses %s, which leaves the project",
    (outputPath) => {
      expect(() => new HooksSection({ outputPath })).toThrow(CapabilityConfigError);
    }
  );

  it("keeps a name that merely holds two dots", () => {
    expect(new HooksSection({ outputPath: ".tool/a..b.json" }).outputPath()).toBe(
      ".tool/a..b.json"
    );
  });
});
