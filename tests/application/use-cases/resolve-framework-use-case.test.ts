import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveFramework } from "../../../src/application/use-cases/resolve-framework-use-case.js";
import type { FrameworkResolved } from "../../../src/domain/ports/framework-resolver.js";

const execFileAsync = promisify(execFile);

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/framework");

function makeLogger(debugLines: string[] = [], infoLines: string[] = []) {
  return {
    debug: (msg: string) => debugLines.push(msg),
    info: (msg: string) => infoLines.push(msg),
    warn: (_msg: string) => {},
  };
}

function makeResolver(result: FrameworkResolved) {
  return {
    resolve: async () => result,
  };
}

describe("resolveFramework()", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-resolve-fw-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("with --framework pointing to a directory", () => {
    it("routes to localPath resolution", async () => {
      let receivedOptions: Record<string, unknown> = {};
      const resolver = {
        resolve: async (opts: Record<string, unknown>) => {
          receivedOptions = opts;
          return { path: FIXTURE_DIR, version: "local", source: "local" as const };
        },
      };

      await resolveFramework(resolver, makeLogger(), { framework: FIXTURE_DIR });

      expect(receivedOptions.localPath).toBe(FIXTURE_DIR);
      expect(receivedOptions.tarballPath).toBeUndefined();
    });

    it("logs the local framework path", async () => {
      const debugLines: string[] = [];
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "local", source: "local" });

      await resolveFramework(resolver, makeLogger(debugLines), { framework: FIXTURE_DIR });

      expect(debugLines.some((m) => m.includes(FIXTURE_DIR))).toBe(true);
    });
  });

  describe("with --framework pointing to a tarball", () => {
    it("routes to tarballPath resolution for .tar.gz files", async () => {
      const tarball = join(tempDir, "framework.tar.gz");
      await writeFile(tarball, "");

      let receivedOptions: Record<string, unknown> = {};
      const resolver = {
        resolve: async (opts: Record<string, unknown>) => {
          receivedOptions = opts;
          return { path: tempDir, version: "local", source: "local" as const };
        },
      };

      await resolveFramework(resolver, makeLogger(), { framework: tarball });

      expect(receivedOptions.tarballPath).toBe(tarball);
      expect(receivedOptions.localPath).toBeUndefined();
    });

    it("routes to tarballPath resolution for .tgz files", async () => {
      const tarball = join(tempDir, "framework.tgz");
      await writeFile(tarball, "");

      let receivedOptions: Record<string, unknown> = {};
      const resolver = {
        resolve: async (opts: Record<string, unknown>) => {
          receivedOptions = opts;
          return { path: tempDir, version: "local", source: "local" as const };
        },
      };

      await resolveFramework(resolver, makeLogger(), { framework: tarball });

      expect(receivedOptions.tarballPath).toBe(tarball);
    });
  });

  describe("without --framework (remote resolution)", () => {
    it("calls resolve with empty options", async () => {
      let receivedOptions: Record<string, unknown> = {};
      const resolver = {
        resolve: async (opts: Record<string, unknown>) => {
          receivedOptions = opts;
          return { path: FIXTURE_DIR, version: "3.0.0", source: "cache" as const };
        },
      };

      await resolveFramework(resolver, makeLogger(), {});

      expect(Object.keys(receivedOptions)).toHaveLength(0);
    });

    it("logs 'Downloading framework...' when source is download", async () => {
      const infoLines: string[] = [];
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "3.0.0", source: "download" });

      await resolveFramework(resolver, makeLogger([], infoLines), {});

      expect(infoLines.some((m) => m.includes("Downloading framework"))).toBe(true);
    });

    it("does not log info when source is cache", async () => {
      const infoLines: string[] = [];
      const resolver = makeResolver({ path: FIXTURE_DIR, version: "3.0.0", source: "cache" });

      await resolveFramework(resolver, makeLogger([], infoLines), {});

      expect(infoLines).toHaveLength(0);
    });

    it("returns the resolved framework", async () => {
      const expected = { path: FIXTURE_DIR, version: "3.5.0", source: "cache" as const };
      const resolver = makeResolver(expected);

      const result = await resolveFramework(resolver, makeLogger(), {});

      expect(result.path).toBe(FIXTURE_DIR);
      expect(result.version).toBe("3.5.0");
    });
  });
});
