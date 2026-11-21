import { describe, expect, it } from "vitest";
import {
  basename,
  isComponentFile,
  isProse,
  makeFile,
  parentDirOf,
  pathBelowHooks,
} from "../../../../src/contexts/translate/domain/plugin-paths.js";

describe("plugin paths", () => {
  it("keeps the tree below hooks/ intact", () => {
    expect(pathBelowHooks("hooks/lib/run.cjs")).toBe("lib/run.cjs");
  });

  it("names the directory and the file of a path", () => {
    expect(parentDirOf("a/b/c.md")).toBe("a/b");
    expect(parentDirOf("c.md")).toBe("");
    expect(basename("a/b/c.md")).toBe("c.md");
  });

  it("calls only markdown prose", () => {
    expect(isProse("skills/x/SKILL.md")).toBe(true);
    expect(isProse("hooks/run.cjs")).toBe(false);
  });

  it("recognises a component by its top directory", () => {
    expect(isComponentFile("rules/a.md")).toBe(true);
    expect(isComponentFile("hooks/hooks.json")).toBe(false);
  });

  it("builds an output file", () => {
    expect(makeFile("a", "b")).toEqual({ relativePath: "a", content: "b" });
  });
});
