import { describe, expect, it } from "vitest";
import {
  buildFileFilter,
  configRefsOf,
} from "../../../../../src/contexts/installation/application/restore/restore-inputs.js";
import { registeredTools } from "../../../../shared/testing/registered-tools.builder.js";

describe("buildFileFilter", () => {
  it("lets every path through when no file was named", () => {
    expect(buildFileFilter(undefined)).toBeNull();
    expect(buildFileFilter([])).toBeNull();
  });

  it("matches a named file exactly", () => {
    const keep = buildFileFilter([".vscode/settings.json"]);
    expect(keep?.(".vscode/settings.json")).toBe(true);
    expect(keep?.(".vscode/settings.json.bak")).toBe(false);
  });

  it("matches a directory, named with or without its slash, by prefix", () => {
    for (const entry of [".cursor/rules", ".cursor/rules/"]) {
      const keep = buildFileFilter([entry]);
      expect(keep?.(".cursor/rules/a.mdc")).toBe(true);
      expect(keep?.(".cursor/rulesets/a.mdc")).toBe(false);
    }
  });
});

describe("configRefsOf", () => {
  it("names each config artifact once, hooks left out", () => {
    const names = configRefsOf(registeredTools()).map((ref) => ref.name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });
});
