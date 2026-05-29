import { describe, expect, it, vi } from "vitest";
import { CheckUpdateUseCase } from "../../src/application/use-cases/check-update-use-case.js";
import { FileHash } from "../../src/domain/models/file.js";
import type { FileReader } from "../../src/domain/ports/file-reader.js";
import type { FileWriter } from "../../src/domain/ports/file-writer.js";
import type { Logger } from "../../src/domain/ports/logger.js";
import type { SelfUpdater } from "../../src/domain/ports/self-updater.js";
import type { VersionReader } from "../../src/domain/ports/version-reader.js";

function makeLogger(): { logger: Logger; logs: string[] } {
  const logs: string[] = [];
  const logger: Logger = {
    debug: () => {},
    info: () => {},
    warn: (m: string) => logs.push(m),
  };
  return { logger, logs };
}

function makeSelfUpdater(latestVersion: string): SelfUpdater {
  return {
    fetchLatestRelease: vi.fn().mockResolvedValue({ version: latestVersion, changelog: "" }),
    install: vi.fn().mockReturnValue("/usr/local/bin/aidd"),
  };
}

function makeVersionReader(version: string): VersionReader {
  return { get: () => version };
}

function makeFsStub(store: Map<string, string> = new Map()): FileReader & FileWriter {
  return {
    readFile: async (path: string) => {
      const content = store.get(path);
      if (content === undefined) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return content;
    },
    fileExists: async (path: string) => store.has(path),
    listDirectory: async () => [],
    readFileHash: async () => new FileHash("a".repeat(32)),
    listFilesRecursive: async () => [],
    writeFile: async (path: string, content: string) => {
      store.set(path, content);
    },
    deleteFile: async (path: string) => {
      store.delete(path);
    },
    createDirectory: async () => {},
    deleteEmptyDirectories: async () => {},
    deleteDirectory: async () => {},
    chmodExecutable: async () => {},
  };
}

describe("CheckUpdateUseCase", () => {
  it("warns when CLI is outdated", async () => {
    const { logger, logs } = makeLogger();
    await new CheckUpdateUseCase(
      makeSelfUpdater("v2.0.0"),
      makeVersionReader("1.0.0"),
      logger,
      makeFsStub()
    ).execute();
    expect(logs.some((l) => l.includes("CLI update available"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd self-update"))).toBe(true);
  });

  it("stays silent when CLI version matches latest", async () => {
    const { logger, logs } = makeLogger();
    await new CheckUpdateUseCase(
      makeSelfUpdater("v1.0.0"),
      makeVersionReader("1.0.0"),
      logger,
      makeFsStub()
    ).execute();
    expect(logs).toHaveLength(0);
  });

  it("stays silent when fetch fails", async () => {
    const { logger, logs } = makeLogger();
    const failing: SelfUpdater = {
      fetchLatestRelease: vi.fn().mockRejectedValue(new Error("network failure")),
      install: vi.fn().mockReturnValue("/usr/local/bin/aidd"),
    };
    await new CheckUpdateUseCase(
      failing,
      makeVersionReader("1.0.0"),
      logger,
      makeFsStub()
    ).execute();
    expect(logs).toHaveLength(0);
  });

  it("skips banner when skipCliCheck is true", async () => {
    const { logger, logs } = makeLogger();
    await new CheckUpdateUseCase(
      makeSelfUpdater("v2.0.0"),
      makeVersionReader("1.0.0"),
      logger,
      makeFsStub()
    ).execute({ skipCliCheck: true });
    expect(logs).toHaveLength(0);
  });

  it("uses cached result within TTL", async () => {
    const { logger, logs } = makeLogger();
    const store = new Map<string, string>();
    const fs = makeFsStub(store);
    const selfUpdater = makeSelfUpdater("v2.0.0");

    // First call: fetch and cache
    await new CheckUpdateUseCase(selfUpdater, makeVersionReader("1.0.0"), logger, fs).execute();
    expect(logs.some((l) => l.includes("CLI update available"))).toBe(true);
    expect(vi.mocked(selfUpdater.fetchLatestRelease)).toHaveBeenCalledTimes(1);

    // Second call: should use cache, not fetch again
    const { logger: logger2, logs: logs2 } = makeLogger();
    await new CheckUpdateUseCase(selfUpdater, makeVersionReader("1.0.0"), logger2, fs).execute();
    expect(logs2.some((l) => l.includes("CLI update available"))).toBe(true);
    expect(vi.mocked(selfUpdater.fetchLatestRelease)).toHaveBeenCalledTimes(1); // still 1, used cache
  });
});
