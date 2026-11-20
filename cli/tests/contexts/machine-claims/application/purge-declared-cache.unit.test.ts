import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PurgeDeclaredCache } from "../../../../src/contexts/machine-claims/application/purge-declared-cache.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.js";
import { errnoError, FaultingFileAdapter } from "../../../shared/testing/faulting-file-adapter.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.js";

const CACHE_ROOT = "/cache";
const CANDIDATE = join(CACHE_ROOT, "mkt");
const LABEL = "codex: cache for 'mkt'";

describe("PurgeDeclaredCache.resolveCandidate", () => {
  it("answers nothing, silently, when the cache root does not exist", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", CACHE_ROOT, errnoError("ENOENT"));
    const logger = new CapturingLogger();

    const candidate = await new PurgeDeclaredCache(fs, logger).resolveCandidate(
      CACHE_ROOT,
      "mkt",
      LABEL
    );

    expect(candidate).toBeNull();
    expect(logger.allMessages).toStrictEqual([]);
  });

  it("answers nothing, silently, when the candidate does not exist", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", CANDIDATE, errnoError("ENOENT"));
    const logger = new CapturingLogger();

    const candidate = await new PurgeDeclaredCache(fs, logger).resolveCandidate(
      CACHE_ROOT,
      "mkt",
      LABEL
    );

    expect(candidate).toBeNull();
    expect(logger.allMessages).toStrictEqual([]);
  });
});

describe("PurgeDeclaredCache.resolveCandidate on a filesystem that rejects a missing path", () => {
  it("answers nothing, silently, when the cache root does not exist", async () => {
    const fs = new InMemoryFileAdapter();
    const logger = new CapturingLogger();

    const candidate = await new PurgeDeclaredCache(fs, logger).resolveCandidate(
      CACHE_ROOT,
      "mkt",
      LABEL
    );

    expect(candidate).toBeNull();
    expect(logger.allMessages).toStrictEqual([]);
  });

  it("answers nothing, silently, when only the candidate is missing", async () => {
    const fs = new InMemoryFileAdapter({
      [join(CACHE_ROOT, "other", "f")]: "x",
    });
    const logger = new CapturingLogger();

    const candidate = await new PurgeDeclaredCache(fs, logger).resolveCandidate(
      CACHE_ROOT,
      "mkt",
      LABEL
    );

    expect(candidate).toBeNull();
    expect(logger.allMessages).toStrictEqual([]);
  });

  it("answers the candidate when it exists inside the root", async () => {
    const fs = new InMemoryFileAdapter({ [join(CANDIDATE, "f")]: "x" });

    expect(
      await new PurgeDeclaredCache(fs, new CapturingLogger()).resolveCandidate(
        CACHE_ROOT,
        "mkt",
        LABEL
      )
    ).toBe(CANDIDATE);
  });
});
