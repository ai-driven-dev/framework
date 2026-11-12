import "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { UserPluginFileUpdater } from "../../../../../src/contexts/framework/application/ownership/user-plugin-file-updater.js";
import { PluginDistributionLoader } from "../../../../../src/contexts/framework/application/plugin/plugin-distribution-loader.js";
import { InstalledPlugin } from "../../../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import { PluginDistribution } from "../../../../../src/contexts/translate/domain/plugin-distribution.js";
import { InstallationFile } from "../../../../../src/kernel/file.js";
import { FileAdapter } from "../../../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../../src/runtime/filesystem/hasher-adapter.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { FixturePluginFetcher } from "../../../../helpers/ports/fixture-plugin-fetcher.js";
import { InMemoryMarketplaceRegistry } from "../../../../helpers/ports/in-memory-marketplace-registry.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(tool: "opencode" | "kilo") {
  const home = await mkdtemp(join(tmpdir(), "aidd-machine-rebuild-"));
  roots.push(home);
  const hasher = new HasherAdapter();
  const fs = new FileAdapter(hasher);
  const content = "# installed content\n";
  const path = "skills/aidd-context/00-onboard/SKILL.md";
  const file = new InstallationFile({ relativePath: path, content, hash: hasher.hash(content) });
  const files = [file];
  const dist = new PluginDistribution({
    manifest: { name: "aidd-context", version: "2.9.0" },
    format: "claude",
    files: [],
    components: { commands: [], agents: [], rules: [], skills: [], hooks: [], mcp: [] },
  });
  const source = {
    kind: "git-subdir",
    url: "https://github.com/ai-driven-dev/framework.git",
    path: "plugins/aidd-context",
    ref: "v5.12.0",
    sha: "a".repeat(40),
  } as const;
  const plugin = InstalledPlugin.fromMetadata(
    "aidd-context",
    "2.9.0",
    source,
    false,
    "user"
  ).withFiles(new Map([[path, file.hash.value]]));
  const updater = new UserPluginFileUpdater(
    fs,
    new PluginDistributionLoader(new FixturePluginFetcher(), { read: async () => dist }),
    hasher,
    {
      ensureBuilt: {
        execute: async () => {
          throw new Error("unexpected shared build");
        },
      },
      marketplaceRegistry: new InMemoryMarketplaceRegistry(),
      homedir: () => home,
      pinnedFramework: { build: async () => ({ sha: source.sha, dist, files }) },
    }
  );
  const target = join(home, ".config", tool, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
  return {
    fs,
    updater,
    plugin,
    target,
    content,
    home,
    hasher,
    files,
    dist,
    source,
    logger: new CapturingLogger(),
  };
}

describe("rebuilding an owned machine plugin", () => {
  it("refuses a missing owned file before a prepared release update", async () => {
    const f = await fixture("opencode");
    await rm(f.target);
    await expect(
      f.updater.planUpdate(f.plugin, "opencode", "/project", f.logger, true, {
        sha: f.source.sha,
        dist: f.dist,
        files: f.files,
      })
    ).rejects.toThrow(/unsafe recorded files/);
  });

  it.each(["opencode", "kilo"] as const)("restores a deleted %s file", async (tool) => {
    const f = await fixture(tool);
    await rm(f.target);
    const plan = await f.updater.planUpdate(f.plugin, tool, "/project", f.logger, true);
    if (!plan) throw new Error("expected rebuild plan");
    const installed = await f.updater.applyUpdate(plan, f.logger);
    expect(await readFile(f.target, "utf8")).toBe(f.content);
    expect(installed.files).toEqual(f.plugin.files);
  });

  it("refuses an edited tracked file without changing it", async () => {
    const f = await fixture("opencode");
    await writeFile(f.target, "user edit\n");
    await expect(
      f.updater.planUpdate(f.plugin, "opencode", "/project", f.logger, true)
    ).rejects.toThrow(/edited/);
    expect(await readFile(f.target, "utf8")).toBe("user edit\n");
  });

  it("refuses a file created after the rebuild was planned", async () => {
    const f = await fixture("opencode");
    await rm(f.target);
    const plan = await f.updater.planUpdate(f.plugin, "opencode", "/project", f.logger, true);
    if (!plan) throw new Error("expected rebuild plan");
    await writeFile(f.target, "new user content\n");
    await expect(f.updater.applyUpdate(plan, f.logger)).rejects.toThrow(/edited/);
    expect(await readFile(f.target, "utf8")).toBe("new user content\n");
  });

  it.skipIf(process.platform === "win32")("does not replace a dangling symlink", async () => {
    const f = await fixture("opencode");
    await rm(f.target);
    await symlink("/definitely-missing-aidd-target", f.target);
    await expect(
      f.updater.planUpdate(f.plugin, "opencode", "/project", f.logger, true)
    ).rejects.toThrow();
    expect(await readlink(f.target)).toBe("/definitely-missing-aidd-target");
  });

  it.skipIf(process.platform === "win32")(
    "does not replace an existing tracked symlink when another file is missing",
    async () => {
      const f = await fixture("opencode");
      const relativePath = "skills/aidd-context/00-onboard/other.md";
      const file = new InstallationFile({
        relativePath,
        content: f.content,
        hash: f.hasher.hash(f.content),
      });
      f.files.push(file);
      const plugin = f.plugin.withFiles(
        new Map([...f.plugin.files, [relativePath, file.hash.value]])
      );
      const sibling = join(f.home, ".config/opencode/owned-target.md");
      await writeFile(sibling, f.content);
      await rm(f.target);
      await symlink(sibling, f.target);
      await expect(
        f.updater.planUpdate(plugin, "opencode", "/project", f.logger, true)
      ).rejects.toThrow(/symlink/);
      expect(await readlink(f.target)).toBe(sibling);
    }
  );

  it.skipIf(process.platform === "win32")(
    "rechecks an existing tracked file turned into a symlink after planning",
    async () => {
      const f = await fixture("opencode");
      const relativePath = "skills/aidd-context/00-onboard/other.md";
      const file = new InstallationFile({
        relativePath,
        content: f.content,
        hash: f.hasher.hash(f.content),
      });
      f.files.push(file);
      const plugin = f.plugin.withFiles(
        new Map([...f.plugin.files, [relativePath, file.hash.value]])
      );
      const sibling = join(f.home, ".config/opencode/owned-target.md");
      await writeFile(sibling, f.content);
      const plan = await f.updater.planUpdate(plugin, "opencode", "/project", f.logger, true);
      if (!plan) throw new Error("expected rebuild plan");
      await rm(f.target);
      await symlink(sibling, f.target);
      await expect(f.updater.applyUpdate(plan, f.logger)).rejects.toThrow(/symlink/);
      expect(await readlink(f.target)).toBe(sibling);
    }
  );

  it.skipIf(process.platform === "win32")(
    "rechecks a dangling symlink created after planning",
    async () => {
      const f = await fixture("opencode");
      await rm(f.target);
      const plan = await f.updater.planUpdate(f.plugin, "opencode", "/project", f.logger, true);
      if (!plan) throw new Error("expected rebuild plan");
      await symlink("/definitely-missing-aidd-target", f.target);
      await expect(f.updater.applyUpdate(plan, f.logger)).rejects.toThrow();
      expect(await readlink(f.target)).toBe("/definitely-missing-aidd-target");
    }
  );

  it.skipIf(process.platform === "win32")(
    "refuses an untracked destination symlink even when its bytes match",
    async () => {
      const f = await fixture("opencode");
      const relativePath = "skills/aidd-context/00-onboard/new.md";
      const newPath = join(f.home, ".config/opencode", relativePath);
      const sibling = join(f.home, ".config/opencode/user-file.md");
      f.files.push(
        new InstallationFile({ relativePath, content: f.content, hash: f.hasher.hash(f.content) })
      );
      await writeFile(sibling, f.content);
      await rm(f.target);
      await symlink(sibling, newPath);
      await expect(
        f.updater.planUpdate(f.plugin, "opencode", "/project", f.logger, true)
      ).rejects.toThrow(newPath);
      expect(await readlink(newPath)).toBe(sibling);
      expect(await readFile(sibling, "utf8")).toBe(f.content);
    }
  );

  it.skipIf(process.platform === "win32")(
    "rechecks an untracked destination symlink created after planning",
    async () => {
      const f = await fixture("opencode");
      const relativePath = "skills/aidd-context/00-onboard/new.md";
      const newPath = join(f.home, ".config/opencode", relativePath);
      const sibling = join(f.home, ".config/opencode/user-file.md");
      f.files.push(
        new InstallationFile({ relativePath, content: f.content, hash: f.hasher.hash(f.content) })
      );
      await writeFile(sibling, "user content\n");
      await rm(f.target);
      const plan = await f.updater.planUpdate(f.plugin, "opencode", "/project", f.logger, true);
      if (!plan) throw new Error("expected rebuild plan");
      await symlink(sibling, newPath);
      await expect(f.updater.applyUpdate(plan, f.logger)).rejects.toThrow(newPath);
      expect(await readlink(newPath)).toBe(sibling);
      expect(await readFile(sibling, "utf8")).toBe("user content\n");
    }
  );

  it.skipIf(process.platform === "win32")(
    "refuses an untracked dangling destination symlink",
    async () => {
      const f = await fixture("opencode");
      const relativePath = "skills/aidd-context/00-onboard/new.md";
      const newPath = join(f.home, ".config/opencode", relativePath);
      const destination = join(f.home, "missing-user-file");
      f.files.push(
        new InstallationFile({ relativePath, content: f.content, hash: f.hasher.hash(f.content) })
      );
      await rm(f.target);
      await symlink(destination, newPath);
      await expect(
        f.updater.planUpdate(f.plugin, "opencode", "/project", f.logger, true)
      ).rejects.toThrow(/symlink/);
      expect(await readlink(newPath)).toBe(destination);
    }
  );

  it.skipIf(process.platform === "win32")(
    "refuses a new destination under a symlinked parent",
    async () => {
      const f = await fixture("opencode");
      const relativePath = "skills/aidd-context/linked/new.md";
      const parent = join(f.home, ".config/opencode/skills/aidd-context/linked");
      const destination = join(f.home, ".config/opencode/user-directory");
      f.files.push(
        new InstallationFile({ relativePath, content: f.content, hash: f.hasher.hash(f.content) })
      );
      await mkdir(destination, { recursive: true });
      await rm(f.target);
      await symlink(destination, parent);
      await expect(
        f.updater.planUpdate(f.plugin, "opencode", "/project", f.logger, true)
      ).rejects.toThrow(/symlink/);
      expect(await readlink(parent)).toBe(destination);
    }
  );

  it.skipIf(process.platform === "win32")(
    "rechecks a destination parent replaced by a symlink after planning",
    async () => {
      const f = await fixture("opencode");
      const relativePath = "skills/aidd-context/linked/new.md";
      const parent = join(f.home, ".config/opencode/skills/aidd-context/linked");
      const destination = join(f.home, ".config/opencode/user-directory");
      f.files.push(
        new InstallationFile({ relativePath, content: f.content, hash: f.hasher.hash(f.content) })
      );
      await mkdir(destination, { recursive: true });
      await rm(f.target);
      const plan = await f.updater.planUpdate(f.plugin, "opencode", "/project", f.logger, true);
      if (!plan) throw new Error("expected rebuild plan");
      await symlink(destination, parent);
      await expect(f.updater.applyUpdate(plan, f.logger)).rejects.toThrow(/symlink/);
      expect(await readlink(parent)).toBe(destination);
    }
  );
});

async function cursorFixture() {
  const home = await mkdtemp(join(tmpdir(), "aidd-cursor-rebuild-"));
  roots.push(home);
  const hasher = new HasherAdapter();
  const fs = new FileAdapter(hasher);
  const content = "# installed skill\n";
  const skills = ["one", "two"].map((name) => ({
    relativePath: `skills/${name}/SKILL.md`,
    content,
  }));
  const dist = new PluginDistribution({
    manifest: { name: "aidd-context", version: "2.9.0" },
    format: "claude",
    files: skills,
    components: { commands: [], agents: [], rules: [], skills, hooks: [], mcp: [] },
  });
  const base = join(home, ".cursor/plugins/local");
  const paths = skills.map((skill) => join(base, "aidd-context", skill.relativePath));
  for (const path of paths) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  const plugin = InstalledPlugin.fromMetadata(
    "aidd-context",
    "2.8.0",
    { kind: "local", path: "/source" },
    false,
    "user"
  ).withFiles(
    new Map(
      skills.map((skill) => [`aidd-context/${skill.relativePath}`, hasher.hash(content).value])
    )
  );
  const updater = new UserPluginFileUpdater(
    fs,
    new PluginDistributionLoader(new FixturePluginFetcher(), { read: async () => dist }),
    hasher,
    {
      ensureBuilt: {
        execute: async () => {
          throw new Error("unexpected build");
        },
      },
      marketplaceRegistry: new InMemoryMarketplaceRegistry(),
      homedir: () => home,
    }
  );
  return { home, base, paths, content, plugin, updater, logger: new CapturingLogger() };
}

describe("rebuilding a Cursor user plugin", () => {
  it("restores a deleted plugin directory and its files", async () => {
    const f = await cursorFixture();
    await rm(join(f.base, "aidd-context"), { recursive: true });
    const result = await f.updater.update(f.plugin, "cursor", "/project", f.logger);
    expect(result?.files.size).toBe(2);
    for (const path of f.paths) expect(await readFile(path, "utf8")).toBe(f.content);
  });

  it.skipIf(process.platform === "win32")(
    "preserves a tracked symlink when another file is missing",
    async () => {
      const f = await cursorFixture();
      const sibling = join(f.base, "other.md");
      await writeFile(sibling, f.content);
      await rm(f.paths[0]);
      await symlink(sibling, f.paths[0]);
      await rm(f.paths[1]);
      await expect(f.updater.update(f.plugin, "cursor", "/project", f.logger)).rejects.toThrow(
        /symlink/
      );
      expect(await readlink(f.paths[0])).toBe(sibling);
      expect(await readFile(sibling, "utf8")).toBe(f.content);
    }
  );

  it.skipIf(process.platform === "win32")(
    "preserves an untracked destination symlink",
    async () => {
      const f = await cursorFixture();
      const relative = "aidd-context/skills/one/SKILL.md";
      const files = new Map(f.plugin.files);
      files.delete(relative);
      const sibling = join(f.base, "other.md");
      await writeFile(sibling, f.content);
      await rm(f.paths[0]);
      await symlink(sibling, f.paths[0]);
      await expect(
        f.updater.update(f.plugin.withFiles(files), "cursor", "/project", f.logger)
      ).rejects.toThrow(/symlink/);
      expect(await readlink(f.paths[0])).toBe(sibling);
    }
  );

  it.skipIf(process.platform === "win32")("preserves a symlinked destination parent", async () => {
    const f = await cursorFixture();
    const parent = dirname(f.paths[0]);
    const sibling = join(f.base, "other-directory");
    await mkdir(sibling);
    await writeFile(join(sibling, "SKILL.md"), f.content);
    await rm(parent, { recursive: true });
    await symlink(sibling, parent);
    await expect(f.updater.update(f.plugin, "cursor", "/project", f.logger)).rejects.toThrow(
      /symlink/
    );
    expect(await readlink(parent)).toBe(sibling);
  });
});
