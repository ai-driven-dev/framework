import { describe, expect, it } from "vitest";
import { CapabilityConfigError } from "../../../../../src/contexts/tools/contract/errors/tools.error.js";
import { HooksConfigPart } from "../../../../../src/contexts/tools/domain/sections/hooks-section.js";

describe("a hooks config part", () => {
  const params = { outputPath: ".codex/hooks.json" };

  describe("when asked whether it accepts a path", () => {
    it("returns true for the exact output path", () => {
      const cap = new HooksConfigPart(params);
      expect(cap.accepts(".codex/hooks.json")).toBe(true);
    });

    it("returns false for any other path", () => {
      const cap = new HooksConfigPart(params);
      expect(cap.accepts(".codex/settings.json")).toBe(false);
    });
  });

  describe("when compared with another part", () => {
    it("returns true for identical params", () => {
      const a = new HooksConfigPart(params);
      const b = new HooksConfigPart({ ...params });
      expect(a.equals(b)).toBe(true);
    });

    it("returns false when outputPath differs", () => {
      const a = new HooksConfigPart(params);
      const b = new HooksConfigPart({ outputPath: ".other/hooks.json" });
      expect(a.equals(b)).toBe(false);
    });
  });
});

describe("HooksConfigPart declarations", () => {
  it("consumes nothing unless told otherwise", () => {
    expect(new HooksConfigPart({ outputPath: "h.json" }).consumes("tool-hooks")).toBe(false);
    expect(
      new HooksConfigPart({ outputPath: "h.json", consumes: ["hooks"] }).consumes("hooks")
    ).toBe(true);
  });

  it("writes its file at its path, the user's file winning unless the tool declares otherwise", () => {
    expect(new HooksConfigPart({ outputPath: "h.json" }).fileOf("{}")).toMatchObject({
      relativePath: "h.json",
      mergeStrategy: "user-prime",
    });
    expect(
      new HooksConfigPart({ outputPath: "h.json", mergeStrategy: "none" }).fileOf("{}")
        .mergeStrategy
    ).toBe("none");
  });

  it("differs on the merge strategy alone", () => {
    const cap = new HooksConfigPart({ outputPath: "h.json", mergeStrategy: "none" });

    expect(cap.equals(new HooksConfigPart({ outputPath: "h.json", mergeStrategy: "none" }))).toBe(
      true
    );
    expect(
      cap.equals(new HooksConfigPart({ outputPath: "h.json", mergeStrategy: "user-prime" }))
    ).toBe(false);
  });
});

describe("HooksConfigPart output path", () => {
  it.each(["/etc/hooks.json", "C:\\hooks.json", "\\hooks.json"])(
    "refuses the absolute path %s",
    (outputPath) => {
      expect(() => new HooksConfigPart({ outputPath })).toThrow(CapabilityConfigError);
    }
  );

  it.each(["../hooks.json", "a/../hooks.json", "a\\..\\hooks.json"])(
    "refuses %s, which leaves the project",
    (outputPath) => {
      expect(() => new HooksConfigPart({ outputPath })).toThrow(CapabilityConfigError);
    }
  );

  it("keeps a name that merely holds two dots", () => {
    expect(new HooksConfigPart({ outputPath: ".tool/a..b.json" }).fileOf("").relativePath).toBe(
      ".tool/a..b.json"
    );
  });

  it("names the refused path and the rule it broke", () => {
    expect(() => new HooksConfigPart({ outputPath: "/etc/h.json" })).toThrow(
      expect.objectContaining({
        detail: expect.stringContaining('hooks outputPath "/etc/h.json" must be relative.'),
      })
    );
    expect(() => new HooksConfigPart({ outputPath: "../h.json" })).toThrow(
      expect.objectContaining({
        detail: expect.stringContaining('hooks outputPath "../h.json" must stay in the project.'),
      })
    );
  });
});
