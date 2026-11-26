import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NpmSourceFetcher } from "../../../../src/contexts/distribution/infrastructure/npm-source-fetcher.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";
import { FakeNpmInstaller } from "../testing/npm-installer.fake.js";

let cacheDir: string;

beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "aidd-npm-fetcher-"));
});

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true });
});

describe("fetching an npm source from a real cache directory", () => {
  const source = { kind: "npm", package: "@acme/plugin" } as const;

  it("hands back the installed package directory", async () => {
    const fs = new FileAdapter();
    const fetcher = new NpmSourceFetcher(fs, new FakeNpmInstaller(fs, ["@acme/plugin"]));

    const dir = await fetcher.fetch(source, cacheDir);

    expect(dir).toBe(join(cacheDir, "node_modules", "@acme", "plugin"));
    expect(existsSync(join(dir, "package.json"))).toBe(true);
  });

  it("wipes the previous install on a forced refresh instead of installing over it", async () => {
    const fs = new FileAdapter();
    const stale = join(cacheDir, "node_modules", "@acme", "plugin", "removed-upstream.js");
    await mkdir(join(stale, ".."), { recursive: true });
    await writeFile(stale, "");
    const fetcher = new NpmSourceFetcher(fs, new FakeNpmInstaller(fs, ["@acme/plugin"]));

    await fetcher.fetch(source, cacheDir, { forceRefresh: true });

    expect(existsSync(stale)).toBe(false);
  });
});
