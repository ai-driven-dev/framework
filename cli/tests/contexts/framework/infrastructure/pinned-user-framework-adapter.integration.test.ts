import "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginCatalog } from "../../../../src/contexts/distribution/domain/catalog.js";
import type { PluginCatalogRepository } from "../../../../src/contexts/distribution/domain/ports/plugin-catalog-repository.js";
import type { PluginFetcher } from "../../../../src/contexts/distribution/domain/ports/plugin-fetcher.js";
import type { FrameworkBuildFor } from "../../../../src/contexts/framework/application/shared/ensure-built-marketplace-use-case.js";
import type { PluginDistributionReader } from "../../../../src/contexts/framework/domain/ports/plugin-distribution-reader.js";
import { PinnedUserFrameworkAdapter } from "../../../../src/contexts/framework/infrastructure/pinned-user-framework-adapter.js";
import type { FrameworkBuildOptions } from "../../../../src/contexts/translate/domain/build-target.js";
import { PluginDistribution } from "../../../../src/contexts/translate/domain/plugin-distribution.js";
import { FileAdapter } from "../../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../src/runtime/filesystem/hasher-adapter.js";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "aidd-pinned-framework-"));
  dirs.push(root);
  const repo = join(root, "repo");
  const hooks = join(root, "hooks");
  await mkdir(hooks);
  execFileSync("git", ["init", "--quiet", repo]);
  execFileSync("git", [
    "-C",
    repo,
    "-c",
    "user.name=AIDD Test",
    "-c",
    "user.email=test@example.test",
    "-c",
    `core.hooksPath=${hooks}`,
    "commit",
    "--allow-empty",
    "--no-gpg-sign",
    "-qm",
    "fixture",
  ]);
  const sha = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const fetch = vi.fn<PluginFetcher["fetch"]>(async () => repo);
  const catalog: PluginCatalog = {
    name: "aidd-framework",
    version: "5.13.0",
    plugins: [
      {
        name: "aidd-context",
        version: "2.10.0",
        source: { kind: "local", path: "./plugins/aidd-context" },
        recommended: false,
        strict: false,
      },
    ],
  };
  const load = vi.fn<PluginCatalogRepository["load"]>(async () => catalog);
  const dist = new PluginDistribution({
    manifest: { name: "aidd-context", version: "2.10.0" },
    format: "claude",
    files: [],
    components: { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] },
  });
  const read = vi.fn<PluginDistributionReader["read"]>(async () => dist);
  const execute = vi.fn(async ({ outDir }: FrameworkBuildOptions) => {
    const file = join(outDir, ".opencode", "skills", "aidd-context", "onboard", "SKILL.md");
    const other = join(outDir, ".opencode", "skills", "other", "SKILL.md");
    await mkdir(dirname(file), { recursive: true });
    await mkdir(dirname(other), { recursive: true });
    await writeFile(file, "verified release content");
    await writeFile(other, "other plugin");
    return { outDir, plugins: [], totalFiles: 2 };
  });
  const buildFor = vi.fn<FrameworkBuildFor>(() => ({ execute }));
  const hasher = new HasherAdapter();
  const adapter = new PinnedUserFrameworkAdapter(
    new FileAdapter(hasher),
    hasher,
    { fetch },
    { load },
    { read },
    buildFor
  );
  return { adapter, repo, sha, fetch, load, read, buildFor, execute, catalog, dist };
}

describe("pinned user framework source", () => {
  it("builds only the selected plugin from a verified git commit and rechecks the same SHA", async () => {
    const f = await fixture();
    const result = await f.adapter.build("v5.13.0", "opencode", "aidd-context");
    expect(result.sha).toBe(f.sha);
    expect(result.dist.manifest).toEqual({ name: "aidd-context", version: "2.10.0" });
    expect(result.files.map((file) => [file.relativePath, file.content])).toEqual([
      ["skills/aidd-context/onboard/SKILL.md", "verified release content"],
    ]);
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(f.fetch.mock.calls[0][0]).toEqual({
      kind: "github",
      repo: "ai-driven-dev/framework",
      ref: "v5.13.0",
    });
    expect(f.fetch.mock.calls[1][0]).toEqual({
      kind: "github",
      repo: "ai-driven-dev/framework",
      ref: "v5.13.0",
      sha: f.sha,
    });
    expect(f.fetch.mock.calls[1][1]).toBe(f.fetch.mock.calls[0][1]);
    expect(f.load).toHaveBeenCalledWith(f.repo);
    expect(f.read).toHaveBeenCalledWith(join(f.repo, "plugins", "aidd-context"));
    expect(f.buildFor).toHaveBeenCalledWith("opencode", "flat", expect.any(String));
    expect(f.execute).toHaveBeenCalledWith({
      sourceDir: f.repo,
      outDir: expect.any(String),
      target: "opencode",
      mode: "flat",
    });
    const temporary = dirname(f.fetch.mock.calls[0][1]);
    await expect(new FileAdapter(new HasherAdapter()).fileExists(temporary)).resolves.toBe(false);
  });

  it.each([
    { ref: "main", plugin: "aidd-context" },
    { ref: "5.13.0", plugin: "aidd-context" },
    { ref: "v5.13.0", plugin: "../outside" },
  ])(
    "rejects an unsafe release or plugin name before fetching: $ref / $plugin",
    async ({ ref, plugin }) => {
      const f = await fixture();
      await expect(f.adapter.build(ref, "opencode", plugin)).rejects.toThrow(
        "Expected a versioned official"
      );
      expect(f.fetch).not.toHaveBeenCalled();
    }
  );

  it("rejects a checkout whose commit differs from the recorded SHA", async () => {
    const f = await fixture();
    await expect(
      f.adapter.build("v5.13.0", "opencode", "aidd-context", "0".repeat(40))
    ).rejects.toThrow("does not match the recorded release commit");
    expect(f.load).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([null, { version: "5.12.0", plugins: [] }, { version: "invalid", plugins: [] }])(
    "rejects an absent or mismatched release catalog: %s",
    async (catalog) => {
      const f = await fixture();
      f.load.mockResolvedValue(catalog);
      await expect(f.adapter.build("v5.13.0", "opencode", "aidd-context")).rejects.toThrow(
        "invalid framework marketplace version"
      );
      expect(f.read).not.toHaveBeenCalled();
      expect(f.execute).not.toHaveBeenCalled();
    }
  );

  it("rejects a release that does not contain the installed plugin", async () => {
    const f = await fixture();
    f.load.mockResolvedValue({ ...f.catalog, plugins: [] });
    await expect(f.adapter.build("v5.13.0", "opencode", "aidd-context")).rejects.toThrow(
      "does not contain 'aidd-context'"
    );
    expect(f.read).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "local" as const, path: "../outside" },
    {
      kind: "git-subdir" as const,
      url: "https://example.test/other.git",
      path: "plugins/aidd-context",
      ref: "v5.13.0",
    },
    {
      kind: "git-subdir" as const,
      url: "https://github.com/ai-driven-dev/framework.git",
      path: "plugins/aidd-context",
      ref: "v5.12.0",
    },
    {
      kind: "git-subdir" as const,
      url: "https://github.com/ai-driven-dev/framework.git",
      path: "plugins/other",
      ref: "v5.13.0",
    },
  ])("rejects a catalog entry that resolves to another plugin or source", async (source) => {
    const f = await fixture();
    f.load.mockResolvedValue({ ...f.catalog, plugins: [{ ...f.catalog.plugins[0], source }] });
    await expect(f.adapter.build("v5.13.0", "opencode", "aidd-context")).rejects.toThrow(
      "unverified source"
    );
    expect(f.read).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
  });

  it.each([
    { name: "other", version: "2.10.0" },
    { name: "aidd-context", version: "invalid" },
    { name: "aidd-context", version: "2.9.0" },
  ])("rejects inconsistent installed-plugin metadata: %s", async (manifest) => {
    const f = await fixture();
    f.read.mockResolvedValue(
      new PluginDistribution({
        manifest,
        format: "claude",
        files: [],
        components: { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] },
      })
    );
    await expect(f.adapter.build("v5.13.0", "opencode", "aidd-context")).rejects.toThrow(
      "inconsistent metadata"
    );
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("refuses non-flat hosts and missing build implementations", async () => {
    const nonFlat = await fixture();
    await expect(nonFlat.adapter.build("v5.13.0", "codex", "aidd-context")).rejects.toThrow(
      "supports flat machine installations only"
    );
    expect(nonFlat.execute).not.toHaveBeenCalled();
    const missing = await fixture();
    missing.buildFor.mockReturnValue(undefined);
    await expect(missing.adapter.build("v5.13.0", "opencode", "aidd-context")).rejects.toThrow(
      "no compatible framework build"
    );
    expect(missing.execute).not.toHaveBeenCalled();
  });

  it("fails if the source cannot be verified again after the build", async () => {
    const f = await fixture();
    f.fetch.mockResolvedValueOnce(f.repo).mockRejectedValueOnce(new Error("source moved"));
    await expect(f.adapter.build("v5.13.0", "opencode", "aidd-context")).rejects.toThrow(
      "source moved"
    );
    expect(f.execute).toHaveBeenCalledOnce();
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });
});
