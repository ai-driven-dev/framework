import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NpmSourceFetcher } from "../../../../src/contexts/distribution/infrastructure/npm-source-fetcher.js";
import type { PluginSourceNpm } from "../../../../src/shared/domain/plugin/source.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { FakeNpmInstaller } from "../testing/npm-installer.fake.js";

const CACHE = "/tmp/cache";

let lastFs: InMemoryFileAdapter;
let lastNpm: FakeNpmInstaller;

function adapter(files: Record<string, string> = {}): NpmSourceFetcher {
  lastFs = new InMemoryFileAdapter(files);
  lastNpm = new FakeNpmInstaller(lastFs, ["@acme/plugin"]);
  return new NpmSourceFetcher(lastFs, lastNpm);
}

describe("an npm package as a source", () => {
  it("asks for the pinned version", async () => {
    await adapter().fetch({ kind: "npm", package: "@acme/plugin", version: "1.2.3" }, CACHE);

    expect(lastNpm.installs).toEqual([{ spec: "@acme/plugin@1.2.3", prefix: CACHE }]);
  });

  it("falls back to latest when no version is pinned", async () => {
    await adapter().fetch({ kind: "npm", package: "@acme/plugin" }, CACHE);

    expect(lastNpm.installs.map((i) => i.spec)).toEqual(["@acme/plugin@latest"]);
  });

  it("names the spec it could not install", async () => {
    const fetcher = adapter();

    await expect(
      fetcher.fetch({ kind: "npm", package: "@absent/plugin", version: "9.9.9" }, CACHE)
    ).rejects.toThrow(
      expect.objectContaining({ detail: expect.stringMatching(/@absent\/plugin@9\.9\.9/) })
    );
  });
});

describe("an npm package already installed in the cache", () => {
  const source: PluginSourceNpm = { kind: "npm", package: "@acme/plugin" };
  const installed = { [`${CACHE}/node_modules/@acme/plugin/package.json`]: "{}" };
  const stale = `${CACHE}/node_modules/@acme/plugin/removed-upstream.js`;

  it("is reinstalled from scratch when the caller forces a refresh", async () => {
    const fetcher = adapter({ ...installed, [stale]: "" });

    const result = await fetcher.fetch(source, CACHE, { forceRefresh: true });

    expect(await lastFs.fileExists(stale), "the stale install is wiped, not installed over").toBe(
      false
    );
    expect(lastNpm.installs, "the reinstall still happens after the wipe").toHaveLength(1);
    expect(result).toBe(join(CACHE, "node_modules", "@acme", "plugin"));
  });

  it("is left in place when no refresh is asked for", async () => {
    const fetcher = adapter(installed);

    await fetcher.fetch(source, CACHE);

    expect(await lastFs.fileExists(`${CACHE}/node_modules/@acme/plugin/package.json`)).toBe(true);
  });
});
