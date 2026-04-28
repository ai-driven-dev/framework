import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateRepoFormat } from "../../../src/domain/models/manifest.js";
import type { PluginFetcher } from "../../../src/domain/ports/plugin-fetcher.js";
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

function makeNoopGitFetcher(): PluginFetcher {
  return {
    fetch: vi.fn().mockRejectedValue(new Error("git fetcher must not be called in this test")),
  };
}

describe("FrameworkResolverAdapter", () => {
  let tempDir: string;
  let cacheDir: string;
  let gitCacheDir: string;
  let http: HttpClient;
  let tar: TarExtractor;
  let cache: FrameworkCache;
  let noopFetcher: PluginFetcher;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `resolver-adapter-test-${Date.now()}`);
    cacheDir = join(tempDir, "cache");
    gitCacheDir = join(tempDir, "plugin-cache");
    await mkdir(cacheDir, { recursive: true });

    http = new HttpClient();
    tar = new TarExtractor();
    cache = new FrameworkCache(cacheDir);
    noopFetcher = makeNoopGitFetcher();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("local directory resolution", () => {
    it("uses localPath directly without network access", async () => {
      const localPath = join(tempDir, "local-framework");
      await mkdir(localPath);

      const adapter = new FrameworkResolverAdapter(http, tar, cache, {
        defaultRepo: "unused",
        gitFetcher: noopFetcher,
        gitCacheDir,
      });
      const result = await adapter.resolve({ localPath });
      expect(result.path).toBe(localPath);
      expect(result.version).toBe("local");
    });
  });

  describe("local tarball resolution", () => {
    it("extracts tarball and returns framework root", async () => {
      const { tarballPath } = await createFrameworkTarball(tempDir, "1.0.0");

      const adapter = new FrameworkResolverAdapter(http, tar, cache, {
        defaultRepo: "unused",
        gitFetcher: noopFetcher,
        gitCacheDir,
      });
      const result = await adapter.resolve({ tarballPath });
      expect(result.path).toMatch(/framework-1\.0\.0/);
      expect(result.version).toBe("local");
    });

    it("reports a clear error on invalid tarball", async () => {
      const fakeTarball = join(tempDir, "fake.tar.gz");
      await writeFile(fakeTarball, "not a tarball");

      const adapter = new FrameworkResolverAdapter(http, tar, cache, {
        defaultRepo: "unused",
        gitFetcher: noopFetcher,
        gitCacheDir,
      });
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
          gitFetcher: noopFetcher,
          gitCacheDir,
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
          gitFetcher: noopFetcher,
          gitCacheDir,
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

  describe("remote resolution with --release", () => {
    it("returns from cache when tag is already cached", async () => {
      const { frameworkDir } = await createFrameworkTarball(tempDir, "3.1.0");
      await cache.put("3.1.0", frameworkDir);

      let tarballRequested = false;
      const { url: serverUrl, close } = await startHttpServer((_req, res) => {
        if (_req.url?.includes("/releases/tags/v3.1.0")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              tag_name: "v3.1.0",
              assets: [{ id: 1, name: "aidd-framework-3.1.0.tar.gz" }],
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
          gitFetcher: noopFetcher,
          gitCacheDir,
        });

        const result = await adapter.resolve({ version: "v3.1.0" });
        expect(result.version).toBe("3.1.0");
        expect(result.source).toBe("cache");
        expect(tarballRequested).toBe(false);
      } finally {
        await close();
      }
    });

    it("downloads and caches when tag is not cached", async () => {
      const { tarballPath } = await createFrameworkTarball(tempDir, "3.1.0");
      const tarballBuffer = await readFile(tarballPath);

      const { url: serverUrl, close } = await startHttpServer((_req, res) => {
        if (_req.url?.includes("/releases/tags/v3.1.0")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              tag_name: "v3.1.0",
              assets: [{ id: 42, name: "aidd-framework-3.1.0.tar.gz" }],
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
          gitFetcher: noopFetcher,
          gitCacheDir,
        });

        const result = await adapter.resolve({ version: "v3.1.0" });
        expect(result.version).toBe("3.1.0");
        expect(await cache.has("3.1.0")).toBe(true);
      } finally {
        await close();
      }
    });

    it("reports release not found with HTTP cause and auth hint when tag returns 404", async () => {
      const { url: serverUrl, close } = await startHttpServer((_req, res) => {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Not Found" }));
      });

      try {
        const adapter = new FrameworkResolverAdapter(http, tar, cache, {
          defaultRepo: "test/repo",
          githubApiBase: serverUrl,
          gitFetcher: noopFetcher,
          gitCacheDir,
        });

        await expect(adapter.resolve({ version: "v9.9.9" })).rejects.toThrow(
          /Framework release not found: v9\.9\.9\. Resource not found \(HTTP 404\).*The repository may be private.*gh CLI/
        );
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
        {
          defaultRepo: "test/repo",
          githubApiBase: "http://localhost:1",
          gitFetcher: noopFetcher,
          gitCacheDir,
        },
        logger
      );

      const result = await adapter.resolve({});
      expect(result.path).toContain("4.0.0");
      expect(result.version).toBe("4.0.0");
      expect(warnings.some((w) => w.includes("Network unavailable"))).toBe(true);
    });

    it("aborts when network fails and no local cache is available", async () => {
      const adapter = new FrameworkResolverAdapter(http, tar, cache, {
        defaultRepo: "test/repo",
        githubApiBase: "http://localhost:1",
        gitFetcher: noopFetcher,
        gitCacheDir,
      });

      await expect(adapter.resolve({})).rejects.toThrow("Cannot reach the framework source");
    });
  });

  describe("git clone dispatch", () => {
    it("calls gitFetcher.fetch and returns source: git for non-GitHub repo", async () => {
      const clonedDir = join(tempDir, "cloned-framework");
      await mkdir(clonedDir, { recursive: true });
      await writeFile(join(clonedDir, "version.txt"), "2.0.0");

      const gitFetcher: PluginFetcher = { fetch: vi.fn().mockResolvedValue(clonedDir) };

      const adapter = new FrameworkResolverAdapter(http, tar, cache, {
        defaultRepo: "https://github.com/org/framework.git",
        gitFetcher,
        gitCacheDir,
      });

      const result = await adapter.resolve({ repo: "https://github.com/org/framework.git" });
      expect(result.source).toBe("git");
      expect(result.path).toBe(clonedDir);
      expect(result.version).toBe("2.0.0");
      expect(gitFetcher.fetch).toHaveBeenCalledOnce();
    });

    it("passes ref to gitFetcher when version is provided", async () => {
      const clonedDir = join(tempDir, "cloned-with-ref");
      await mkdir(clonedDir, { recursive: true });

      const gitFetcher: PluginFetcher = { fetch: vi.fn().mockResolvedValue(clonedDir) };

      const adapter = new FrameworkResolverAdapter(http, tar, cache, {
        defaultRepo: "git@github.com:org/framework.git",
        gitFetcher,
        gitCacheDir,
      });

      await adapter.resolve({ repo: "git@github.com:org/framework.git", version: "v1.2.3" });
      const [calledSource] = (gitFetcher.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        { ref?: string },
        string,
      ];
      expect(calledSource.ref).toBe("v1.2.3");
    });
  });

  describe("fetchLatestVersion() with non-GitHub repo", () => {
    it("throws when repo is not GitHub format", async () => {
      const adapter = new FrameworkResolverAdapter(http, tar, cache, {
        defaultRepo: "https://gitlab.com/org/framework.git",
        gitFetcher: noopFetcher,
        gitCacheDir,
      });
      await expect(adapter.fetchLatestVersion()).rejects.toThrow(
        "Version check is not supported for git-cloned framework sources."
      );
    });
  });

  describe("validateRepoFormat()", () => {
    it("accepts valid owner/repo format", () => {
      expect(() => validateRepoFormat("owner/repo")).not.toThrow();
      expect(() => validateRepoFormat("ai-driven-dev/aidd-framework")).not.toThrow();
      expect(() => validateRepoFormat("my_org/my.repo")).not.toThrow();
    });

    it("rejects invalid repository format", () => {
      expect(() => validateRepoFormat("invalid")).toThrow("Invalid repository format");
      expect(() => validateRepoFormat("owner/repo/extra")).toThrow("Invalid repository format");
      expect(() => validateRepoFormat("")).toThrow("Invalid repository format");
      expect(() => validateRepoFormat("owner!/repo")).toThrow("Invalid repository format");
      expect(() => validateRepoFormat("/repo")).toThrow("Invalid repository format");
      expect(() => validateRepoFormat("owner/")).toThrow("Invalid repository format");
    });
  });

  describe("fetchLatestVersion()", () => {
    it("fetches latest version tag from GitHub API", async () => {
      const { url: serverUrl, close } = await startHttpServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ tag_name: "v5.0.0", assets: [] }));
      });

      try {
        const adapter = new FrameworkResolverAdapter(http, tar, cache, {
          defaultRepo: "test/repo",
          githubApiBase: serverUrl,
          gitFetcher: noopFetcher,
          gitCacheDir,
        });

        const version = await adapter.fetchLatestVersion();
        expect(version).toBe("v5.0.0");
      } finally {
        await close();
      }
    });

    it("propagates network error", async () => {
      const adapter = new FrameworkResolverAdapter(http, tar, cache, {
        defaultRepo: "test/repo",
        githubApiBase: "http://localhost:1",
        gitFetcher: noopFetcher,
        gitCacheDir,
      });
      await expect(adapter.fetchLatestVersion()).rejects.toThrow();
    });
  });
});
