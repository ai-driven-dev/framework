import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FrameworkLoaderAdapter } from "../../src/infrastructure/adapters/framework-loader-adapter.js";
import { FrameworkResolverAdapter } from "../../src/infrastructure/adapters/framework-resolver-adapter.js";
import { FrameworkCache } from "../../src/infrastructure/cache/framework-cache.js";
import { HttpClient } from "../../src/infrastructure/http/http-client.js";
import { TarExtractor } from "../../src/infrastructure/tar/tar-extractor.js";

const execFileAsync = promisify(execFile);

const EXAMPLE_DIR = join(process.cwd(), "tests", "fixtures", "framework");
const EXAMPLE_VERSION = "1.0.0";

describe("tests/fixtures/framework — direct directory loading", () => {
  it("builds descriptor from convention with correct sections", async () => {
    const loader = new FrameworkLoaderAdapter();
    const { descriptor } = await loader.loadFromDirectory(EXAMPLE_DIR, EXAMPLE_VERSION);

    expect(descriptor.version).toBe(EXAMPLE_VERSION);

    const sectionNames = descriptor.contentSections.map((s) => s.name);
    expect(sectionNames).toContain("agents");
    expect(sectionNames).toContain("commands");
    expect(sectionNames).toContain("rules");
    expect(sectionNames).toContain("skills");

    expect(descriptor.getContentSection("agents")?.entryFile).toBeNull();
    expect(descriptor.getContentSection("skills")?.entryFile).toBe("SKILL.md");
    expect(descriptor.getTemplate("agentsMd")?.path).toBe("aidd_docs/templates/AGENTS.md");
    expect(descriptor.getConfig("mcp")?.path).toBe("config/mcp.json");
  });

  it("loads all 4 content sections", async () => {
    const loader = new FrameworkLoaderAdapter();
    const { contentFiles } = await loader.loadFromDirectory(EXAMPLE_DIR, EXAMPLE_VERSION);

    const paths = [...contentFiles.keys()];
    expect(contentFiles.size).toBeGreaterThan(0);
    expect(paths.some((p) => p.startsWith("agents/"))).toBe(true);
    expect(paths.some((p) => p.startsWith("commands/"))).toBe(true);
    expect(paths.some((p) => p.startsWith("rules/"))).toBe(true);
    expect(paths.some((p) => p.startsWith("skills/"))).toBe(true);
  });

  it("preserves phase and subfolder structure in file keys", async () => {
    const loader = new FrameworkLoaderAdapter();
    const { contentFiles } = await loader.loadFromDirectory(EXAMPLE_DIR, EXAMPLE_VERSION);

    const paths = [...contentFiles.keys()];
    expect(paths.some((p) => /^commands\/\d+_/.test(p))).toBe(true);
    expect(paths.some((p) => /^skills\/.+\/SKILL\.md$/.test(p))).toBe(true);
  });

  it("content files have non-empty string content", async () => {
    const loader = new FrameworkLoaderAdapter();
    const { contentFiles } = await loader.loadFromDirectory(EXAMPLE_DIR, EXAMPLE_VERSION);

    for (const [path, content] of contentFiles.entries()) {
      expect(typeof content, `${path} should be a string`).toBe("string");
      if (!path.endsWith(".gitkeep")) {
        expect(content.length, `${path} should not be empty`).toBeGreaterThan(0);
      }
    }
  });
});

describe("tests/fixtures/framework — full resolver chain via tarball", () => {
  let tempDir: string;
  let tarballPath: string;
  let cacheDir: string;

  beforeAll(async () => {
    tempDir = join(tmpdir(), `example-resolver-test-${Date.now()}`);
    cacheDir = join(tempDir, "cache");
    await mkdir(cacheDir, { recursive: true });

    tarballPath = join(tempDir, `framework-${EXAMPLE_VERSION}.tar.gz`);
    await execFileAsync("tar", [
      "czf",
      tarballPath,
      "-C",
      join(process.cwd(), "tests", "fixtures"),
      "framework",
    ]);
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("resolves local tarball and loads framework content", async () => {
    const resolver = new FrameworkResolverAdapter(
      new HttpClient(),
      new TarExtractor(),
      new FrameworkCache(cacheDir),
      { defaultRepo: "unused" }
    );

    const { path, version } = await resolver.resolve({ tarballPath });

    const loader = new FrameworkLoaderAdapter();
    const { descriptor, contentFiles } = await loader.loadFromDirectory(path, version);
    expect(descriptor.contentSections.length).toBeGreaterThan(0);
    expect(contentFiles.size).toBeGreaterThan(0);
  });

  it("caches the resolved framework and returns cached path on second resolve", async () => {
    const cache = new FrameworkCache(cacheDir);
    const resolver = new FrameworkResolverAdapter(new HttpClient(), new TarExtractor(), cache, {
      defaultRepo: "unused",
    });

    const { path: first, version } = await resolver.resolve({ tarballPath });
    await cache.put(EXAMPLE_VERSION, first);

    expect(await cache.has(EXAMPLE_VERSION)).toBe(true);
    const cachedPath = cache.get(EXAMPLE_VERSION);

    const loader = new FrameworkLoaderAdapter();
    const { descriptor, contentFiles } = await loader.loadFromDirectory(cachedPath, version);
    expect(descriptor.contentSections.length).toBeGreaterThan(0);
    expect(contentFiles.size).toBeGreaterThan(0);
  });

  it("loads complete content from resolved tarball matching direct directory load", async () => {
    const resolver = new FrameworkResolverAdapter(
      new HttpClient(),
      new TarExtractor(),
      new FrameworkCache(cacheDir),
      { defaultRepo: "unused" }
    );

    const { path: resolvedPath, version } = await resolver.resolve({ tarballPath });
    const loader = new FrameworkLoaderAdapter();

    const fromTarball = await loader.loadFromDirectory(resolvedPath, version);
    const fromDir = await loader.loadFromDirectory(EXAMPLE_DIR, EXAMPLE_VERSION);

    expect(fromTarball.contentFiles.size).toBe(fromDir.contentFiles.size);
    expect([...fromTarball.contentFiles.keys()].sort()).toEqual(
      [...fromDir.contentFiles.keys()].sort()
    );
  });
});
