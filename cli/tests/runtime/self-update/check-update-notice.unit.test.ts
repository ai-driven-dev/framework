import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { CheckUpdateUseCase } from "../../../src/runtime/self-update/check-update-use-case.js";
import { userConfigDir } from "../../../src/runtime/user-config-dir.js";
import { CapturingLogger } from "../../helpers/ports/capturing-logger.js";
import { InMemoryFileAdapter } from "../../helpers/ports/in-memory-file-adapter.js";

const CACHE = join(userConfigDir(), "cache", "update-check.json");

function useCase(fs: InMemoryFileAdapter, current: string, logger = new CapturingLogger()) {
  return new CheckUpdateUseCase(
    {
      fetchLatestRelease: async () => ({ version: "9.0.0", changelog: null }),
      install: () => "/usr/local/bin/aidd",
    },
    { get: () => current },
    logger,
    fs
  );
}

describe("CheckUpdateUseCase, the notice", () => {
  it("names both versions without their v, and the command to run", async () => {
    const fs = new InMemoryFileAdapter({
      [CACHE]: JSON.stringify({ checkedAt: 0, latest: "v2.0.0" }),
    });
    const logger = new CapturingLogger();

    await useCase(fs, "v1.0.0", logger).printFromCacheOnly();

    expect(logger.warnMessages).toStrictEqual([
      "CLI update available: v1.0.0 → v2.0.0",
      "Run `aidd update`.",
    ]);
  });

  it("strips only a leading v, never one inside a pre-release tag", async () => {
    const fs = new InMemoryFileAdapter({
      [CACHE]: JSON.stringify({ checkedAt: 0, latest: "2.0.0-preview" }),
    });
    const logger = new CapturingLogger();

    await useCase(fs, "1.0.0-dev", logger).printFromCacheOnly();

    expect(logger.warnMessages[0]).toBe("CLI update available: v1.0.0-dev → v2.0.0-preview");
  });

  it("says nothing when the cache cannot be read", async () => {
    const fs = new InMemoryFileAdapter({ [CACHE]: "{ not json" });
    const logger = new CapturingLogger();

    await useCase(fs, "1.0.0", logger).printFromCacheOnly();

    expect(logger.warnMessages).toStrictEqual([]);
  });

  it("writes the cache under the cache directory it created", async () => {
    const created: string[] = [];
    const fs = new InMemoryFileAdapter();
    fs.createDirectory = async (path: string) => {
      created.push(path);
    };

    await useCase(fs, "1.0.0").refresh();

    expect(created.map((path) => join(path))).toStrictEqual([dirname(CACHE)]);
    expect(JSON.parse(fs.getFile(CACHE) ?? "{}").latest).toBe("9.0.0");
  });
});
