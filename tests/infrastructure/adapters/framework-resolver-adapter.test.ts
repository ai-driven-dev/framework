import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FrameworkResolverAdapter } from "../../../src/infrastructure/adapters/framework-resolver-adapter.js";
import { FrameworkCache } from "../../../src/infrastructure/cache/framework-cache.js";
import { HttpClient } from "../../../src/infrastructure/http/http-client.js";
import { TarExtractor } from "../../../src/infrastructure/tar/tar-extractor.js";

const execFileAsync = promisify(execFile);

async function createFrameworkTarball(
  tempDir: string,
  version: string
): Promise<{ tarballPath: string; frameworkDir: string }> {
  const frameworkDir = join(tempDir, `framework-${version}`);
  await mkdir(frameworkDir, { recursive: true });
  await writeFile(
    join(frameworkDir, "framework.json"),
    JSON.stringify({ version, content: {}, templates: {}, config: {} })
  );
  const tarballPath = join(tempDir, `framework-${version}.tar.gz`);
  await execFileAsync("tar", ["czf", tarballPath, "-C", tempDir, `framework-${version}`]);
  return { tarballPath, frameworkDir };
}

function startHttpServer(
  handler: (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse
  ) => void
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

describe("FrameworkResolverAdapter", () => {
  let tempDir: string;
  let cacheDir: string;
  let http: HttpClient;
  let tar: TarExtractor;
  let cache: FrameworkCache;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `resolver-adapter-test-${Date.now()}`);
    cacheDir = join(tempDir, "cache");
    await mkdir(cacheDir, { recursive: true });

    http = new HttpClient();
    tar = new TarExtractor();
    cache = new FrameworkCache(cacheDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("local directory resolution", () => {
    it("returns localPath directly without network access", async () => {
      const localPath = join(tempDir, "local-framework");
      await mkdir(localPath);

      const adapter = new FrameworkResolverAdapter(http, tar, cache, { defaultRepo: "unused" });
      const result = await adapter.resolve({ localPath });
      expect(result.path).toBe(localPath);
      expect(result.version).toBe("local");
    });
  });

  describe("local tarball resolution", () => {
    it("extracts tarball and returns framework root", async () => {
      const { tarballPath } = await createFrameworkTarball(tempDir, "1.0.0");

      const adapter = new FrameworkResolverAdapter(http, tar, cache, { defaultRepo: "unused" });
      const result = await adapter.resolve({ tarballPath });
      expect(result.path).toMatch(/framework-1\.0\.0/);
      expect(result.version).toBe("local");
    });

    it("throws on invalid tarball", async () => {
      const fakeTarball = join(tempDir, "fake.tar.gz");
      await writeFile(fakeTarball, "not a tarball");

      const adapter = new FrameworkResolverAdapter(http, tar, cache, { defaultRepo: "unused" });
      await expect(adapter.resolve({ tarballPath: fakeTarball })).rejects.toThrow(
        "Failed to extract tarball"
      );
    });
  });

  describe("remote resolution with cache hit", () => {
    it("skips download when version is already cached", async () => {
      const { frameworkDir } = await createFrameworkTarball(tempDir, "3.0.0");
      await cache.put("3.0.0", frameworkDir);

      let tarballRequested = false;
      const { url: serverUrl, close } = await startHttpServer((_req, res) => {
        if (_req.url?.includes("/releases/latest")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              tag_name: "v3.0.0",
              assets: [{ name: "framework.tar.gz", browser_download_url: `${serverUrl}/tarball` }],
            })
          );
        } else {
          tarballRequested = true;
          res.writeHead(200, { "Content-Type": "application/octet-stream" });
          res.end(Buffer.alloc(0));
        }
      });

      try {
        const adapter = new FrameworkResolverAdapter(http, tar, cache, {
          defaultRepo: "test/repo",
          githubApiBase: serverUrl,
        });

        const result = await adapter.resolve({});
        expect(result.path).toContain("3.0.0");
        expect(result.version).toBe("3.0.0");
        expect(tarballRequested).toBe(false);
      } finally {
        await close();
      }
    });
  });

  describe("remote resolution with full download", () => {
    it("downloads, extracts, caches and returns path on cache miss", async () => {
      const { tarballPath } = await createFrameworkTarball(tempDir, "6.0.0");
      const tarballBuffer = await readFile(tarballPath);

      const { url: serverUrl, close } = await startHttpServer((_req, res) => {
        if (_req.url?.includes("/releases/latest")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              tag_name: "v6.0.0",
              assets: [
                {
                  name: "aidd-framework-6.0.0.tar.gz",
                  browser_download_url: `${serverUrl}/tarball`,
                },
              ],
            })
          );
        } else {
          res.writeHead(200, { "Content-Type": "application/octet-stream" });
          res.end(tarballBuffer);
        }
      });

      try {
        const adapter = new FrameworkResolverAdapter(http, tar, cache, {
          defaultRepo: "test/repo",
          githubApiBase: serverUrl,
        });

        const result = await adapter.resolve({});
        expect(result.path).toMatch(/6\.0\.0/);
        expect(result.version).toBe("6.0.0");
        expect(await cache.has("6.0.0")).toBe(true);
      } finally {
        await close();
      }
    });
  });

  describe("offline fallback", () => {
    it("falls back to latest cached version on network failure", async () => {
      const { frameworkDir } = await createFrameworkTarball(tempDir, "4.0.0");
      await cache.put("4.0.0", frameworkDir);

      const warnings: string[] = [];
      const logger = {
        debug: (_msg: string) => {},
        info: (_msg: string) => {},
        warn: (msg: string) => warnings.push(msg),
      };

      const adapter = new FrameworkResolverAdapter(
        http,
        tar,
        cache,
        { defaultRepo: "test/repo", githubApiBase: "http://localhost:1" },
        logger
      );

      const result = await adapter.resolve({});
      expect(result.path).toContain("4.0.0");
      expect(result.version).toBe("4.0.0");
      expect(warnings.some((w) => w.includes("Network unavailable"))).toBe(true);
    });

    it("throws when network fails and no cache exists", async () => {
      const adapter = new FrameworkResolverAdapter(http, tar, cache, {
        defaultRepo: "test/repo",
        githubApiBase: "http://localhost:1",
      });

      await expect(adapter.resolve({})).rejects.toThrow("Cannot resolve framework");
    });
  });

  describe("getLatestVersion()", () => {
    it("returns tag_name from GitHub API", async () => {
      const { url: serverUrl, close } = await startHttpServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ tag_name: "v5.0.0", assets: [] }));
      });

      try {
        const adapter = new FrameworkResolverAdapter(http, tar, cache, {
          defaultRepo: "test/repo",
          githubApiBase: serverUrl,
        });

        const version = await adapter.getLatestVersion();
        expect(version).toBe("v5.0.0");
      } finally {
        await close();
      }
    });

    it("returns null on network failure", async () => {
      const adapter = new FrameworkResolverAdapter(http, tar, cache, {
        defaultRepo: "test/repo",
        githubApiBase: "http://localhost:1",
      });
      const version = await adapter.getLatestVersion();
      expect(version).toBeNull();
    });
  });
});
