import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ResolvePurgeCandidate } from "../../../../src/contexts/machine-claims/application/resolve-purge-candidate.use-case.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../../shared/testing/faulting-file-adapter.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";

const CACHE_ROOT = "/cache";
const CANDIDATE = join(CACHE_ROOT, "mkt");
const LABEL = "codex: cache for 'mkt'";

describe("resolving a cache directory to purge", () => {
  it("answers nothing, silently, when the cache root does not exist", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", CACHE_ROOT, errnoError("ENOENT"));
    const logger = new CapturingLogger();

    const candidate = await new ResolvePurgeCandidate(fs, logger).execute(CACHE_ROOT, "mkt", LABEL);

    expect(candidate).toBeNull();
    expect(logger.allMessages).toStrictEqual([]);
  });

  it("answers nothing, silently, when the candidate does not exist", async () => {
    const fs = new FaultingFileAdapter();
    fs.failOn("realpath", CANDIDATE, errnoError("ENOENT"));
    const logger = new CapturingLogger();

    const candidate = await new ResolvePurgeCandidate(fs, logger).execute(CACHE_ROOT, "mkt", LABEL);

    expect(candidate).toBeNull();
    expect(logger.allMessages).toStrictEqual([]);
  });
});

describe("ResolvePurgeCandidate on a filesystem that rejects a missing path", () => {
  it("answers nothing, silently, when the cache root does not exist", async () => {
    const fs = new InMemoryFileAdapter();
    const logger = new CapturingLogger();

    const candidate = await new ResolvePurgeCandidate(fs, logger).execute(CACHE_ROOT, "mkt", LABEL);

    expect(candidate).toBeNull();
    expect(logger.allMessages).toStrictEqual([]);
  });

  it("answers nothing, silently, when only the candidate is missing", async () => {
    const fs = new InMemoryFileAdapter({
      [join(CACHE_ROOT, "other", "f")]: "x",
    });
    const logger = new CapturingLogger();

    const candidate = await new ResolvePurgeCandidate(fs, logger).execute(CACHE_ROOT, "mkt", LABEL);

    expect(candidate).toBeNull();
    expect(logger.allMessages).toStrictEqual([]);
  });

  it("answers the candidate when it exists inside the root", async () => {
    const fs = new InMemoryFileAdapter({ [join(CANDIDATE, "f")]: "x" });

    expect(
      await new ResolvePurgeCandidate(fs, new CapturingLogger()).execute(CACHE_ROOT, "mkt", LABEL)
    ).toBe(CANDIDATE);
  });
});

describe("ResolvePurgeCandidate on a candidate that escaped its root", () => {
  it("answers nothing and names the path it leaves in place", async () => {
    const fs = new InMemoryFileAdapter({ "/elsewhere/f": "x" }, [CACHE_ROOT]);
    fs.setSymlink(CANDIDATE, "/elsewhere");
    const logger = new CapturingLogger();

    const candidate = await new ResolvePurgeCandidate(fs, logger).execute(CACHE_ROOT, "mkt", LABEL);

    expect(candidate).toBeNull();
    expect(logger.allMessages).toStrictEqual([
      `${LABEL} does not resolve inside ${CACHE_ROOT}; left in place: ${CANDIDATE}`,
    ]);
  });
});
