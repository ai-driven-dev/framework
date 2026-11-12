import { describe, expect, it } from "vitest";
import { Manifest } from "../../../../src/contexts/framework/domain/manifest.js";
import { aiddGitignoreEntries } from "../../../../src/contexts/framework/domain/manifest-gitignore-entries.js";

describe("aiddGitignoreEntries", () => {
  it("lists the plugin cache when no tool is installed", () => {
    expect(aiddGitignoreEntries(Manifest.create(), () => [])).toEqual([".aidd/cache/"]);
  });

  it("adds the machine-local files the answer gives for each installed tool, once", () => {
    const manifest = Manifest.create();
    manifest.addTool("claude", "1.0.0", []);
    manifest.addTool("codex", "1.0.0", []);
    const asked: string[] = [];

    const entries = aiddGitignoreEntries(manifest, (toolId) => {
      asked.push(toolId);
      return [".shared.local", `.${toolId}.local`];
    });

    expect(entries).toEqual([".aidd/cache/", ".shared.local", ".claude.local", ".codex.local"]);
    expect(asked).toEqual(["claude", "codex"]);
  });
});
