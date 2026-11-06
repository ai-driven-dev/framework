import "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import "../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginCatalogRepository } from "../../../../src/contexts/distribution/domain/ports/plugin-catalog-repository.js";
import type { PluginFetcher } from "../../../../src/contexts/distribution/domain/ports/plugin-fetcher.js";
import type { FrameworkBuildFor } from "../../../../src/contexts/framework/application/shared/ensure-built-marketplace-use-case.js";
import type { PluginDistributionReader } from "../../../../src/contexts/framework/domain/ports/plugin-distribution-reader.js";
import { PinnedUserFrameworkAdapter } from "../../../../src/contexts/framework/infrastructure/pinned-user-framework-adapter.js";
import { PluginDistribution } from "../../../../src/contexts/translate/domain/plugin-distribution.js";
import { FileAdapter } from "../../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../src/runtime/filesystem/hasher-adapter.js";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "aidd-pinned-session-"));
  dirs.push(root);
  const origin = join(root, "origin");
  execFileSync("git", ["init", "--quiet", origin]);
  execFileSync("git", [
    "-C",
    origin,
    "-c",
    "user.name=AIDD",
    "-c",
    "user.email=aidd@example.test",
    "commit",
    "--allow-empty",
    "--no-gpg-sign",
    "-qm",
    "fixture",
  ]);
  const sha = execFileSync("git", ["-C", origin, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const refs = new Map<string, string>();
  const clonePaths: string[] = [];
  const fetch = vi.fn<PluginFetcher["fetch"]>(async (source, cache) => {
    if (source.kind !== "github" || !source.ref) throw new Error("unexpected source");
    const checkout = join(cache, "checkout");
    if (!refs.has(checkout)) {
      await mkdir(cache, { recursive: true });
      execFileSync("git", ["clone", "--quiet", origin, checkout]);
      refs.set(checkout, source.ref);
      clonePaths.push(checkout);
    }
    const head = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    if (source.sha && source.sha !== head) throw new Error("source SHA mismatch");
    return checkout;
  });
  const load = vi.fn<PluginCatalogRepository["load"]>(async (checkout) => ({
    name: "aidd-framework",
    version: refs.get(checkout)?.slice(1),
    plugins: ["aidd-context", "aidd-dev"].map((name) => ({
      name,
      version: "1.0.0",
      source: { kind: "local" as const, path: `./plugins/${name}` },
      strict: false,
      recommended: false,
    })),
  }));
  const read = vi.fn<PluginDistributionReader["read"]>(
    async (dir) =>
      new PluginDistribution({
        manifest: { name: basename(dir), version: "1.0.0" },
        format: "claude",
        files: [],
        components: { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] },
      })
  );
  const execute = vi.fn(async ({ outDir, target }: { outDir: string; target: string }) => {
    for (const name of ["aidd-context", "aidd-dev"]) {
      const file = join(outDir, `.${target}`, "skills", name, "demo", "SKILL.md");
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, `${target}:${name}`);
    }
    return { outDir, plugins: [], totalFiles: 2 };
  });
  const buildFor: FrameworkBuildFor = vi.fn(() => ({ execute }));
  const hasher = new HasherAdapter();
  const fs = new FileAdapter(hasher);
  const adapter = new PinnedUserFrameworkAdapter(
    fs,
    hasher,
    { fetch },
    { load },
    { read },
    buildFor
  );
  return { adapter, sha, clonePaths, fetch, load, read, execute, fs };
}

describe("one pinned framework operation", () => {
  it("reuses one checkout and one build per tool for two plugins, then removes it", async () => {
    const f = await fixture();
    if (!f.adapter.withSession) throw new Error("session unavailable");
    const results = await f.adapter.withSession(async (session) => {
      const values = [];
      for (const tool of ["opencode", "kilo"] as const)
        for (const name of ["aidd-context", "aidd-dev"])
          values.push(
            await session.build("v5.13.0", tool, name, values.length ? f.sha : undefined)
          );
      expect(f.clonePaths).toHaveLength(1);
      expect(f.execute).toHaveBeenCalledTimes(2);
      expect(f.fetch.mock.calls[0][0]).not.toHaveProperty("sha");
      expect(f.fetch.mock.calls[0][2]).toEqual({ canonicalCheckout: true });
      expect(await f.fs.fileExists(f.clonePaths[0])).toBe(true);
      return values;
    });
    expect(results.map((v) => v.files.map((file) => file.content))).toEqual([
      ["opencode:aidd-context"],
      ["opencode:aidd-dev"],
      ["kilo:aidd-context"],
      ["kilo:aidd-dev"],
    ]);
    expect(results.every((v) => v.sha === f.sha)).toBe(true);
    expect(await f.fs.fileExists(f.clonePaths[0])).toBe(false);
  });

  it("does not share a checkout between operations or distinct refs", async () => {
    const f = await fixture();
    if (!f.adapter.withSession) throw new Error("session unavailable");
    await f.adapter.withSession(async (s) => {
      await s.build("v5.13.0", "opencode", "aidd-context", f.sha);
      await s.build("v5.14.0", "opencode", "aidd-context", f.sha);
    });
    await f.adapter.withSession(async (s) => {
      await s.build("v5.13.0", "opencode", "aidd-context", f.sha);
    });
    expect(f.clonePaths).toHaveLength(3);
    expect(new Set(f.clonePaths).size).toBe(3);
    expect(f.execute).toHaveBeenCalledTimes(3);
    for (const checkout of f.clonePaths) expect(await f.fs.fileExists(checkout)).toBe(false);
  });

  it("refuses a different recorded commit even when the ref was already built", async () => {
    const f = await fixture();
    if (!f.adapter.withSession) throw new Error("session unavailable");
    await expect(
      f.adapter.withSession(async (session) => {
        await session.build("v5.13.0", "opencode", "aidd-context", f.sha);
        await session.build("v5.13.0", "opencode", "aidd-dev", "0".repeat(40));
      })
    ).rejects.toThrow("does not match the recorded release commit");
    expect(f.clonePaths).toHaveLength(1);
    expect(f.execute).toHaveBeenCalledTimes(1);
    expect(await f.fs.fileExists(f.clonePaths[0])).toBe(false);
  });

  it("cleans temporary files after an error and checks each plugin's metadata", async () => {
    const f = await fixture();
    if (!f.adapter.withSession) throw new Error("session unavailable");
    f.read.mockImplementationOnce(
      async () =>
        new PluginDistribution({
          manifest: { name: "aidd-context", version: "1.0.0" },
          format: "claude",
          files: [],
          components: { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] },
        })
    );
    f.read.mockImplementationOnce(
      async () =>
        new PluginDistribution({
          manifest: { name: "wrong", version: "1.0.0" },
          format: "claude",
          files: [],
          components: { skills: [], commands: [], agents: [], rules: [], hooks: [], mcp: [] },
        })
    );
    await expect(
      f.adapter.withSession(async (s) => {
        await s.build("v5.13.0", "opencode", "aidd-context", f.sha);
        await s.build("v5.13.0", "opencode", "aidd-dev", f.sha);
      })
    ).rejects.toThrow("inconsistent metadata");
    expect(f.execute).toHaveBeenCalledTimes(1);
    expect(await f.fs.fileExists(f.clonePaths[0])).toBe(false);
  });
});
