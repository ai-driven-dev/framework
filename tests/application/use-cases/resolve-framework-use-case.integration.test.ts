import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResolveFrameworkUseCase } from "../../../src/application/use-cases/resolve-framework-use-case.js";
import type { FrameworkResolved } from "../../../src/domain/ports/framework-resolver.js";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/framework");

function makeLogger(debugLines: string[] = [], infoLines: string[] = []) {
  return {
    debug: (msg: string) => debugLines.push(msg),
    info: (msg: string) => infoLines.push(msg),
    warn: (_msg: string) => {},
  };
}

const stubFetchLatestVersion = async () => "v0.0.0";

function makeResolver(result: FrameworkResolved) {
  return {
    resolve: async () => result,
    fetchLatestVersion: stubFetchLatestVersion,
    getDefaultRepo: () => undefined,
  };
}

describe("framework resolver", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-resolve-fw-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("with --path pointing to a directory", () => {
    it("uses local directory as framework source", async () => {
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "local", source: "local" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({
        path: FIXTURE_DIR,
      });

      expect(result.path).toBe(FIXTURE_DIR);
      expect(result.version).toBe("local");
      expect(result.source).toBe("local");
    });
  });

  describe("with --path pointing to a tarball", () => {
    it("extracts .tar.gz as framework source", async () => {
      const tarball = join(tempDir, "framework.tar.gz");
      await writeFile(tarball, "");

      const resolver = makeResolver({ path: tempDir, version: "local", source: "local" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({
        path: tarball,
      });

      expect(result.path).toBe(tempDir);
      expect(result.version).toBe("local");
      expect(result.source).toBe("local");
    });

    it("extracts .tgz as framework source", async () => {
      const tarball = join(tempDir, "framework.tgz");
      await writeFile(tarball, "");

      const resolver = makeResolver({ path: tempDir, version: "local", source: "local" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({
        path: tarball,
      });

      expect(result.path).toBe(tempDir);
      expect(result.source).toBe("local");
    });
  });

  describe("with --from (auto-detect version or local path)", () => {
    it("treats a version string as release", async () => {
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "3.6.0", source: "cache" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({
        from: "3.6.0",
      });

      expect(result.version).toBe("3.6.0");
    });

    it("treats an absolute path as local framework", async () => {
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "local", source: "local" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({
        from: FIXTURE_DIR,
      });

      expect(result.source).toBe("local");
    });

    it("treats a relative ./ path as local framework", async () => {
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "local", source: "local" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({
        from: "./some/path",
      });

      expect(result.source).toBe("local");
    });

    it("treats a ../ path as local framework", async () => {
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "local", source: "local" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({
        from: "../some/path",
      });

      expect(result.source).toBe("local");
    });

    it("treats a .tar.gz path as local framework", async () => {
      const resolver = makeResolver({ path: tempDir, version: "local", source: "local" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({
        from: "/some/framework.tar.gz",
      });

      expect(result.source).toBe("local");
    });

    it("treats a .tgz path as local framework", async () => {
      const resolver = makeResolver({ path: tempDir, version: "local", source: "local" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({
        from: "/some/framework.tgz",
      });

      expect(result.source).toBe("local");
    });

    it("takes precedence over release and framework when all three are set", async () => {
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "3.6.0", source: "cache" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({
        from: "3.6.0",
        release: "2.0.0",
        path: "/other/path",
      });

      expect(result.version).toBe("3.6.0");
    });
  });

  describe("without --path (remote resolution)", () => {
    it("uses cached framework when available", async () => {
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "3.0.0", source: "cache" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({});

      expect(result.path).toBe(FIXTURE_DIR);
      expect(result.version).toBe("3.0.0");
      expect(result.source).toBe("cache");
    });

    it("downloads framework from remote when not cached", async () => {
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "3.0.0", source: "download" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({});

      expect(result.path).toBe(FIXTURE_DIR);
      expect(result.version).toBe("3.0.0");
      expect(result.source).toBe("download");
    });

    it("pins to specified release tag when --release is set", async () => {
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "3.1.0", source: "cache" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({
        release: "v3.1.0",
      });

      expect(result.path).toBe(FIXTURE_DIR);
      expect(result.version).toBe("3.1.0");
      expect(result.source).toBe("cache");
    });

    it("prefers local framework over --release when both are specified", async () => {
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "local", source: "local" });

      const result = await new ResolveFrameworkUseCase(resolver, makeLogger()).execute({
        path: FIXTURE_DIR,
        release: "v3.1.0",
      });

      expect(result.path).toBe(FIXTURE_DIR);
      expect(result.version).toBe("local");
      expect(result.source).toBe("local");
    });
  });
});
