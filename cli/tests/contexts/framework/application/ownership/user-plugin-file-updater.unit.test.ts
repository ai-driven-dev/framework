import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UserPluginDistributionLoader } from "../../../../../src/contexts/framework/application/ownership/user-plugin-distribution-loader.js";
import { UserPluginFileUpdater } from "../../../../../src/contexts/framework/application/ownership/user-plugin-file-updater.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { DeterministicHasher } from "../../../../helpers/ports/deterministic-hasher.js";
import { FixturePluginFetcher } from "../../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";

function fixture(installedVersion = "0.0.1") {
  const fs = new InMemoryFileAdapter();
  const hasher = new DeterministicHasher();
  const logger = new CapturingLogger();
  const content = "# Updated skill";
  const skill = { relativePath: "skills/demo/SKILL.md", content };
  const dist = new PluginDistribution({
    manifest: { name: "sample-plugin", version: "1.0.0" },
    format: "claude",
    files: [skill],
    components: { commands: [], agents: [], rules: [], skills: [skill], hooks: [], mcp: [] },
  });
  const updater = new UserPluginFileUpdater(
    fs,
    new UserPluginDistributionLoader(new FixturePluginFetcher(), { read: async () => dist }),
    hasher
  );
  const plugin = InstalledPlugin.fromMetadata(
    "sample-plugin",
    installedVersion,
    { kind: "local", path: "/source" },
    false,
    "user"
  ).withDependents(["/A", "/B"]);
  const base = join(homedir(), ".cursor/plugins/local");
  return { fs, hasher, logger, updater, plugin, base, content };
}

describe("UserPluginFileUpdater public update contract", () => {
  it.each(["1.0.0", "2.0.0"])(
    "leaves version %s unchanged when no upgrade exists",
    async (version) => {
      const f = fixture(version);
      expect(await f.updater.update(f.plugin, "cursor", "/A", f.logger)).toBeNull();
      expect(await f.fs.fileExists(join(f.base, "sample-plugin/skills/demo/SKILL.md"))).toBe(false);
      expect(f.plugin.version).toBe(version);
      expect(f.plugin.dependents).toEqual(["/A", "/B"]);
    }
  );

  it("applies a planned upgrade through the public convenience method and preserves dependents", async () => {
    const f = fixture();
    const result = await f.updater.update(f.plugin, "cursor", "/A", f.logger);
    expect(result?.version).toBe("1.0.0");
    expect(result?.scope).toBe("user");
    expect(result?.dependents).toEqual(["/A", "/B"]);
    expect(await f.fs.readFile(join(f.base, "sample-plugin/skills/demo/SKILL.md"))).toBe(f.content);
    expect(result?.files.get("sample-plugin/skills/demo/SKILL.md")).toBe(
      f.hasher.hash(f.content).value
    );
  });

  it("refuses unsafe recorded files with an actionable diagnostic before writes", async () => {
    const f = fixture();
    const unsafe = f.plugin.withFiles(
      new Map([["../foreign.txt", f.hasher.hash("foreign").value]])
    );
    await f.fs.writeFile(join(f.base, "../foreign.txt"), "foreign");
    await expect(f.updater.update(unsafe, "cursor", "/A", f.logger)).rejects.toThrow(
      "cursor: 'sample-plugin' has unsafe recorded files; update refused without dropping its machine claim."
    );
    expect(await f.fs.readFile(join(f.base, "../foreign.txt"))).toBe("foreign");
    expect(await f.fs.fileExists(join(f.base, "sample-plugin/skills/demo/SKILL.md"))).toBe(false);
  });

  it("rechecks planned new-file containment when a parent becomes a symlink", async () => {
    const f = fixture();
    const plan = await f.updater.planUpdate(f.plugin, "cursor", "/A", f.logger);
    if (plan === null) throw new Error("Expected upgrade plan");
    await f.fs.writeFile("/foreign/skills/demo/SKILL.md", "foreign");
    f.fs.setSymlink(join(f.base, "sample-plugin"), "/foreign");
    await expect(f.updater.applyUpdate(plan, f.logger)).rejects.toThrow(
      `cursor: 'sample-plugin' directory is not safely inside ${f.base}; update refused.`
    );
    expect(await f.fs.readFile("/foreign/skills/demo/SKILL.md")).toBe("foreign");
  });
});
