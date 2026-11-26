import { describe, expect, it } from "vitest";
import type { Located } from "../../../../../src/contexts/telemetry/application/switch/read-clone-consent.use-case.js";
import { RememberOwnRoot } from "../../../../../src/contexts/telemetry/application/switch/remember-own-root.use-case.js";
import { resolutionKey } from "../../../../../src/contexts/telemetry/domain/repository-resolution.js";
import { cloneOf } from "../../testing/clone.builder.js";
import { InMemoryLedger } from "../../testing/in-memory-ledger.fake.js";
import { InMemoryResolutions } from "../../testing/in-memory-resolutions.fake.js";

const CLONE = cloneOf("/w/main/.git");
const T1 = "2026-10-01T00:00:00.000Z";

const located = (extra: Partial<Located> = {}): Located => ({
  status: "repository",
  root: "/w/repo",
  mainRoot: "/w/main",
  clone: CLONE,
  remote: "r",
  rootCommit: "c",
  ...extra,
});

const setup = (caseInsensitiveFileSystem = false) => {
  const ledger = new InMemoryLedger();
  const resolutions = new InMemoryResolutions();
  const remember = new RememberOwnRoot(ledger, resolutions, {
    caseInsensitiveFileSystem,
    now: () => new Date(T1),
  });
  return { ledger, resolutions, remember };
};

describe("remembering the root `on` ran in", () => {
  it("remembers the root in its clone, under the ledger's lock", async () => {
    const s = setup();
    await s.remember.execute(located());
    expect(s.ledger.exclusiveRuns).toBe(1);
    expect(s.resolutions.resolutions.get(resolutionKey("/w/repo", CLONE))).toMatchObject({
      dir: "/w/repo",
      root: "/w/repo",
      clone: CLONE,
      seen_at: T1,
    });
  });

  it("writes nothing the second time", async () => {
    const s = setup();
    await s.remember.execute(located());
    await s.remember.execute(located());
    expect(s.resolutions.saves).toBe(1);
  });

  it("remembers a clone the file system gives no identity as nothing", async () => {
    const s = setup();
    await s.remember.execute(located({ clone: null }));
    expect(s.resolutions.saves).toBe(0);
  });

  it("remembers a repository with neither a remote nor a commit as nothing", async () => {
    const s = setup();
    await s.remember.execute(located({ remote: null, rootCommit: null }));
    expect(s.resolutions.saves).toBe(0);
  });

  it("folds the spelling of a directory on a file system that ignores case", async () => {
    const s = setup(true);
    await s.remember.execute(located({ root: "/W/Repo" }));
    expect(s.resolutions.resolutions.get(resolutionKey("/w/repo", CLONE))).toMatchObject({
      dir: "/w/repo",
      root: "/W/Repo",
    });
  });
});
