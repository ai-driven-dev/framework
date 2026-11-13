import { describe, expect, it } from "vitest";
import { Manifest } from "../../../../src/contexts/framework/domain/manifest.js";
import { aiddGitignoreEntries } from "../../../../src/contexts/framework/domain/manifest-gitignore-entries.js";
import { TOOL } from "../../tools/testing/catalog-of.js";

describe("aiddGitignoreEntries", () => {
  it("lists the plugin cache when no tool is installed", () => {
    expect(aiddGitignoreEntries(Manifest.create(), () => [])).toEqual([".aidd/cache/"]);
  });

  it("adds the machine-local files the answer gives for each installed tool, once", () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    manifest.addTool(TOOL.codex, "1.0.0", []);
    const asked: string[] = [];

    const entries = aiddGitignoreEntries(manifest, (toolId) => {
      asked.push(toolId);
      return [".shared.local", `.${toolId}.local`];
    });

    expect(entries).toEqual([".aidd/cache/", ".shared.local", ".claude.local", ".codex.local"]);
    expect(asked).toEqual(["claude", "codex"]);
  });
});
