import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UserScopePluginFiles } from "../../../../../src/contexts/installation/application/removal/user-scope-plugin-files.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const HOME = "/fake-home";
const tool = registeredTools().aiProfile(TOOL.cursor);
const plugin = InstalledPlugin.fromMetadata(
  "aidd-context",
  "1.0.0",
  { kind: "local", path: "/p" },
  false,
  "user"
);

describe("UserScopePluginFiles.proven", () => {
  it("answers what the proof answers for this plugin, tool and home", async () => {
    const proof = new Map([["skills/x.md", "digest"]]);
    const seen: unknown[] = [];
    const files = new UserScopePluginFiles(new InMemoryFileAdapter(), async (...args) => {
      seen.push(args);
      return proof;
    });

    await expect(files.proven(plugin, tool, HOME)).resolves.toBe(proof);
    expect(seen).toEqual([[plugin, tool, HOME]]);
  });
});

describe("UserScopePluginFiles.remove", () => {
  it("deletes the given files from the user plugins directory of the tool", async () => {
    const fs = new InMemoryFileAdapter();
    const target = join(tool.plugins()?.userPluginsBaseDir(homedir()) ?? "", "skills", "x.md");
    fs.setFile(target, "x");

    await new UserScopePluginFiles(fs, async () => new Map()).remove(
      new Map([["skills/x.md", "digest"]]),
      tool,
      "/project"
    );

    expect(fs.has(target)).toBe(false);
  });
});
