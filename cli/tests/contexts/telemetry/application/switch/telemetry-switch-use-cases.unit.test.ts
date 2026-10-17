import { describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../../src/contexts/telemetry/application/directory-resolver.js";
import { rememberOwnRoot } from "../../../../../src/contexts/telemetry/application/switch/remember-own-root.js";
import { TelemetryOffUseCase } from "../../../../../src/contexts/telemetry/application/switch/telemetry-off-use-case.js";
import { TelemetryOnUseCase } from "../../../../../src/contexts/telemetry/application/switch/telemetry-on-use-case.js";
import { cloneKey } from "../../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import type { LocatedDirectory } from "../../../../../src/contexts/telemetry/domain/ports/repository-locator.js";
import {
  type RepositoryResolution,
  resolutionKey,
} from "../../../../../src/contexts/telemetry/domain/repository-resolution.js";
import {
  cloneOf,
  FakeConsents,
  FakeLocator,
  InMemoryConsentHistory,
  InMemoryIdentity,
  InMemoryLedger,
  InMemoryResolutions,
} from "../../../../helpers/ports/in-memory-telemetry.js";

const NO_HOOK = { lineRemoved: false, delegateRemoved: false, stillCalledBy: [] };
const NO_JOURNAL = { journalRemoved: false, trackedKept: false, ignoreEntryRemoved: false };
const repository = (
  root: string,
  mainRoot = root,
  extra: { remote?: string | null; rootCommit?: string | null } = {}
): Extract<LocatedDirectory, { status: "repository" }> => ({
  status: "repository",
  root,
  mainRoot,
  clone: cloneOf(`${mainRoot}/.git`),
  remote: "r",
  rootCommit: "c",
  ...extra,
});

const ID = "c";
const MAIN = cloneOf("/w/main/.git");
const T1 = "2026-10-01T00:00:00.000Z";
const T2 = "2026-10-02T00:00:00.000Z";
const T3 = "2026-10-03T00:00:00.000Z";

/** A working tree that is gone, as ingest remembered it in `clone`. */
function deleted(clone = MAIN, dir = "/gone/x"): RepositoryResolution {
  return { dir, repository_id: ID, root: dir, clone, seen_at: "2026-09-01T00:00:00.000Z" };
}

function setup(settings: (string | null)[] = []) {
  const events: string[] = [];
  let minted = 0;
  const locator = new FakeLocator();
  const consents = new FakeConsents();
  const ledger = new InMemoryLedger(events);
  const resolutions = new InMemoryResolutions();
  const history = new InMemoryConsentHistory();
  const clock = { now: new Date(T1) };
  const writes: { root: string; value: string }[] = [];
  const config = {
    texts: new Map<string, string>(),
    written: [] as { root: string; text: string }[],
    removed: [] as string[],
  };
  const hooksSeen: string[] = [];
  const journalSeen: string[] = [];
  const identities = new InMemoryIdentity();
  const writer = {
    async set(root: string, value: string) {
      events.push("consent");
      writes.push({ root, value });
      consents.values.set(root, value);
      const located = await locator.locate(root);
      if (located.status === "repository" && located.clone !== null) {
        consents.cloneSays(located.clone, value);
      }
    },
  };
  const on = new TelemetryOnUseCase(
    locator,
    consents,
    writer,
    {
      async read(root) {
        return config.texts.get(root) ?? null;
      },
      async write(root, text) {
        events.push("config");
        config.written.push({ root, text });
      },
      async remove(root) {
        events.push("config-removed");
        config.removed.push(root);
      },
    },
    {
      async clean(root) {
        events.push("hooks");
        hooksSeen.push(root);
        return { ...NO_HOOK, lineRemoved: true };
      },
    },
    {
      async clean(root) {
        events.push("journal");
        journalSeen.push(root);
        return NO_JOURNAL;
      },
    },
    ledger,
    resolutions,
    history,
    { texts: async () => settings },
    { caseInsensitiveFileSystem: false, now: () => clock.now },
    () => `tok-${++minted}`,
    identities
  );
  const off = new TelemetryOffUseCase(locator, consents, writer, ledger, history, () => clock.now);
  locator.directories.set("/w/repo", repository("/w/repo", "/w/main"));
  return {
    on,
    off,
    locator,
    consents,
    ledger,
    resolutions,
    history,
    clock,
    writes,
    config,
    events,
    hooksSeen,
    journalSeen,
    identities,
  };
}

describe("aidd telemetry on", () => {
  it("writes consent before it cleans, and cleans the repository it was run in", async () => {
    const s = setup();
    const result = await s.on.execute("/w/repo", "keep");
    expect(s.events.slice(0, 5)).toEqual(["lock", "consent", "unlock", "hooks", "journal"]);
    expect(s.writes).toEqual([{ root: "/w/repo", value: "2:tok-1" }]);
    expect(s.hooksSeen).toEqual(["/w/repo"]);
    expect(s.journalSeen).toEqual(["/w/repo"]);
    expect(result).toMatchObject({
      status: "on",
      consentWritten: true,
      legacyConfig: "none",
      hook: { lineRemoved: true },
    });
  });

  it("still cleans, and writes no consent, when the clone already granted this version", async () => {
    const s = setup();
    await s.on.execute("/w/repo", "keep");
    s.writes.length = 0;
    const result = await s.on.execute("/w/repo", "keep");
    expect(s.writes).toEqual([]);
    expect(s.hooksSeen).toEqual(["/w/repo", "/w/repo"]);
    expect(result).toMatchObject({ status: "on", consentWritten: false });
  });

  it("grants again over a withdrawn, a previous, a hand-set or a forged value", async () => {
    for (const value of ["off", "1", "true", "2", "2:forged"]) {
      const s = setup();
      s.consents.values.set("/w/repo", value);
      await s.on.execute("/w/repo", "keep");
      expect(s.writes).toEqual([{ root: "/w/repo", value: "2:tok-1" }]);
    }
  });

  it("mints a fresh token each time it opens an interval", async () => {
    const s = setup();
    await s.on.execute("/w/repo", "keep");
    await s.off.execute("/w/repo");
    await s.on.execute("/w/repo", "keep");
    expect(s.writes.map((write) => write.value)).toEqual(["2:tok-1", "off", "2:tok-2"]);
  });

  it("writes the key before the interval, so a crash between leaves a key that measures nothing", async () => {
    const s = setup();
    const append = s.history.append.bind(s.history);
    s.history.append = async (event) => {
      s.events.push(`interval-${event.kind}`);
      await append(event);
    };
    await s.on.execute("/w/repo", "keep");
    expect(s.events.slice(0, 4)).toEqual(["lock", "consent", "interval-open", "unlock"]);
  });

  it("removes the previous version's block from .aidd/config.json and keeps the rest", async () => {
    const s = setup();
    s.config.texts.set(
      "/w/repo",
      '{\n  "keep": 1,\n  "telemetry": { "enabled": true, "endpoint": "x" }\n}\n'
    );
    const result = await s.on.execute("/w/repo", "keep");
    expect(result).toMatchObject({ legacyConfig: "block-removed" });
    expect(s.config.written).toEqual([{ root: "/w/repo", text: '{\n  "keep": 1\n}\n' }]);
    expect(s.config.removed).toEqual([]);
  });

  it("deletes .aidd/config.json when the block was all it held", async () => {
    const s = setup();
    s.config.texts.set("/w/repo", '{"telemetry":{"enabled":true,"endpoint":"x"}}');
    expect(await s.on.execute("/w/repo", "keep")).toMatchObject({ legacyConfig: "file-deleted" });
    expect(s.config.removed).toEqual(["/w/repo"]);
    expect(s.config.written).toEqual([]);
  });

  it("leaves a config that does not parse alone, and still turns measurement on", async () => {
    const s = setup();
    s.config.texts.set("/w/repo", "{nope");
    expect(await s.on.execute("/w/repo", "keep")).toMatchObject({
      consentWritten: true,
      legacyConfig: "unparseable",
    });
    expect(s.config.written).toEqual([]);
    expect(s.config.removed).toEqual([]);
  });

  it("never reads .aidd/config.json as consent", async () => {
    const s = setup();
    s.config.texts.set("/w/repo", '{"telemetry":{"enabled":true,"version":2}}');
    const result = await s.on.execute("/w/repo", "keep");
    expect(result).toMatchObject({ consentWritten: true });
    expect(s.writes).toEqual([{ root: "/w/repo", value: "2:tok-1" }]);
  });

  it("refuses outside a repository without touching anything", async () => {
    const s = setup();
    expect(await s.on.execute("/elsewhere", "keep")).toEqual({
      status: "refused",
      reason: "outside-repository",
    });
    expect(s.events).toEqual([]);
  });

  it("refuses a repository git cannot read, as an unreadable git config, without touching anything", async () => {
    const s = setup();
    s.locator.directories.set("/w/broken", { status: "unreadable" });
    expect(await s.on.execute("/w/broken", "keep")).toEqual({
      status: "refused",
      reason: "unreadable-git-config",
    });
    expect(await s.off.execute("/w/broken")).toEqual({
      status: "refused",
      reason: "unreadable-git-config",
    });
    expect(s.events).toEqual([]);
    expect(s.writes).toEqual([]);
  });

  it("refuses a git config it cannot read without touching anything", async () => {
    const s = setup();
    s.consents.unreadable.add("/w/repo");
    expect(await s.on.execute("/w/repo", "keep")).toEqual({
      status: "refused",
      reason: "unreadable-git-config",
    });
    expect(s.events).toEqual([]);
  });

  it("reads nothing back: the offsets are left as they are, and the root is remembered under the lock", async () => {
    const s = setup();
    s.ledger.stored.set("/t", { offset: 9, size: 9, identity: "i" });
    await s.on.execute("/w/repo", "keep");
    expect(s.ledger.stored.size).toBe(1);
    expect(s.events.slice(5)).toEqual(["lock", "unlock"]);
  });

  it("remembers its own root, seen alive, so forget can find the clone later", async () => {
    const s = setup();
    await s.on.execute("/w/repo", "keep");
    expect(s.resolutions.resolutions.get(resolutionKey("/w/repo", MAIN))).toEqual({
      dir: "/w/repo",
      repository_id: ID,
      root: "/w/repo",
      clone: MAIN,
      seen_at: T1,
    });
  });

  it("remembers nothing of a clone the file system gives no identity", async () => {
    // `on` refuses such a clone before it remembers anything: the resolution is guarded too.
    const s = setup();
    await rememberOwnRoot(
      s.resolutions,
      { ...repository("/w/repo", "/w/main"), clone: null },
      false,
      new Date(T1)
    );
    expect(s.resolutions.saves).toBe(0);
  });

  it("opens the clone's interval at its own time, once", async () => {
    const s = setup();
    await s.on.execute("/w/repo", "keep");
    s.clock.now = new Date(T2);
    await s.on.execute("/w/repo", "keep");
    expect(s.history.written).toEqual([{ kind: "open", token: "tok-1", clone: MAIN, at: T1 }]);
  });

  it("opens an interval again when the key was set by hand, with none open", async () => {
    for (const value of ["2", "2:forged"]) {
      const s = setup();
      s.consents.values.set("/w/repo", value);
      await s.on.execute("/w/repo", "keep");
      expect(s.history.written).toEqual([{ kind: "open", token: "tok-1", clone: MAIN, at: T1 }]);
      expect(s.writes).toEqual([{ root: "/w/repo", value: "2:tok-1" }]);
    }
  });

  it("closes an interval of the clone that its key no longer names before it opens the next", async () => {
    const s = setup();
    s.history.written.push({ kind: "open", token: "old", clone: MAIN, at: T1 });
    s.consents.values.set("/w/repo", "off");
    s.clock.now = new Date(T2);
    await s.on.execute("/w/repo", "keep");
    expect(s.history.written).toEqual([
      { kind: "open", token: "old", clone: MAIN, at: T1 },
      { kind: "close", token: "old", at: T2 },
      { kind: "open", token: "tok-1", clone: MAIN, at: T2 },
    ]);
  });

  it("leaves another clone's interval alone", async () => {
    const s = setup();
    const other = cloneOf("/w/other/.git");
    s.history.written.push({ kind: "open", token: "theirs", clone: other, at: T1 });
    await s.on.execute("/w/repo", "keep");
    expect(s.history.written.map((event) => event.kind)).toEqual(["open", "open"]);
  });

  it("opens the consent under the ledger's lock, with the key", async () => {
    const s = setup();
    await s.on.execute("/w/repo", "keep");
    expect(s.events.slice(0, 3)).toEqual(["lock", "consent", "unlock"]);
  });

  it("refuses a clone the file system gives no identity, and changes nothing", async () => {
    const s = setup();
    s.locator.directories.set("/w/repo", { ...repository("/w/repo", "/w/main"), clone: null });
    expect(await s.on.execute("/w/repo", "keep")).toEqual({
      status: "refused",
      reason: "unidentified-clone",
    });
    expect(s.events).toEqual([]);
    expect(s.history.written).toEqual([]);
  });

  it("remembers nothing of a repository with neither a remote nor a commit", async () => {
    const s = setup();
    s.locator.directories.set(
      "/w/repo",
      repository("/w/repo", "/w/main", { remote: null, rootCommit: null })
    );
    await s.on.execute("/w/repo", "keep");
    expect(s.resolutions.saves).toBe(0);
  });

  describe("what a deleted directory is, after `on` in a clone", () => {
    async function resolvedAfterOn(
      s: ReturnType<typeof setup>,
      entry: RepositoryResolution,
      at = T3
    ) {
      s.resolutions.resolutions.set(resolutionKey(entry.dir, entry.clone), entry);
      await s.on.execute("/w/repo", "keep");
      const run = await new DirectoryResolver(s.locator, s.consents, s.resolutions, s.history, {
        caseInsensitiveFileSystem: false,
        now: () => s.clock.now,
      }).open();
      return run.resolve(entry.dir, at);
    }

    it("stores a deleted linked worktree of the clone that opted in", async () => {
      const s = setup();
      expect(await resolvedAfterOn(s, deleted(MAIN), T1)).toMatchObject({ stored: {} });
    });

    it("keeps refusing a deleted clone of the same remote that never opted in", async () => {
      const s = setup();
      expect(await resolvedAfterOn(s, deleted(cloneOf("/w/b2/.git")))).toEqual({
        skipped: "no-consent",
      });
    });

    it("keeps refusing a clone of the same remote that ran off, deleted or not", async () => {
      for (const alive of [false, true]) {
        const s = setup();
        const b2 = cloneOf("/w/b2/.git");
        s.history.written.push(
          { kind: "open", token: "b2", clone: b2, at: "2026-09-01T00:00:00.000Z" },
          { kind: "close", token: "b2", at: "2026-09-02T00:00:00.000Z" }
        );
        if (alive) s.consents.cloneSays(b2, "off");
        expect(await resolvedAfterOn(s, deleted(b2))).toEqual({ skipped: "no-consent" });
      }
    });

    it("keeps refusing a deleted copy with no remote that shares the root commit", async () => {
      const s = setup();
      s.locator.directories.set("/w/repo", repository("/w/repo", "/w/main", { remote: null }));
      expect(await resolvedAfterOn(s, deleted(cloneOf("/w/copy/.git")))).toEqual({
        skipped: "no-consent",
      });
    });

    it("keeps refusing a clone made at the path of the one that was seen", async () => {
      const s = setup();
      const successor = cloneOf(MAIN.path, { ino: "99" });
      s.locator.directories.set("/w/repo", {
        ...repository("/w/repo", "/w/main"),
        clone: successor,
      });
      expect(await resolvedAfterOn(s, deleted(MAIN))).toEqual({ skipped: "no-consent" });
    });
  });

  it("does not rewrite what it already remembered of its own root", async () => {
    const s = setup();
    await s.on.execute("/w/repo", "keep");
    await s.on.execute("/w/repo", "keep");
    expect(s.resolutions.saves).toBe(1);
  });

  it.each([
    [[null, null, null], 30, true],
    [[null, '{"cleanupPeriodDays":3650}', null], 3650, false],
    [['{"cleanupPeriodDays":3649}', '{"cleanupPeriodDays":3650}'], 3649, true],
  ])("reports retention from %j", async (settings, days, short) => {
    const s = setup(settings as (string | null)[]);
    expect(await s.on.execute("/w/repo", "keep")).toMatchObject({ retention: { days, short } });
  });
});

describe("aidd telemetry on, given who the clone is measured as", () => {
  it("writes the identity chosen once the clone is on, and names it", async () => {
    const s = setup();
    const result = await s.on.execute("/w/repo", { set: " Ada Example " });
    expect(s.identities.personId).toBe("Ada Example");
    expect(result).toMatchObject({
      status: "on",
      identity: { personId: "Ada Example", previous: null },
    });
  });

  it("replaces the identity already set, and names the previous one", async () => {
    const s = setup();
    s.identities.personId = "Ada at Home";
    const result = await s.on.execute("/w/repo", { set: "Ada Example" });
    expect(s.identities.personId).toBe("Ada Example");
    expect(result).toMatchObject({
      identity: { personId: "Ada Example", previous: "Ada at Home" },
    });
  });

  it("writes no identity when the clone is refused, whatever was chosen", async () => {
    const s = setup();
    s.locator.directories.set("/w/repo", { ...repository("/w/repo", "/w/main"), clone: null });
    for (const cwd of ["/elsewhere", "/w/repo"]) {
      expect(await s.on.execute(cwd, { set: "Ada Example" })).toMatchObject({
        status: "refused",
      });
    }
    expect(s.identities.writes).toBe(0);
    expect(s.writes).toEqual([]);
  });

  it("writes no identity when the consent log cannot be trusted", async () => {
    const s = setup();
    s.history.damaged = true;
    expect(await s.on.execute("/w/repo", { set: "Ada Example" })).toEqual({
      status: "refused",
      reason: "damaged-consent-log",
    });
    expect(s.identities.writes).toBe(0);
  });

  it("refuses an identifier the identity rules refuse, before writing anything", async () => {
    for (const typed of ["  ", "Ada\nExample", "a".repeat(129)]) {
      const s = setup();
      expect(await s.on.execute("/w/repo", { set: typed })).toEqual({
        status: "refused",
        reason: "invalid-identity",
      });
      expect(s.events).toEqual([]);
      expect(s.identities.writes).toBe(0);
    }
  });

  it("refuses to stay anonymous while an identity is set, before writing anything", async () => {
    const s = setup();
    s.identities.personId = "Ada Example";
    expect(await s.on.execute("/w/repo", "none")).toEqual({
      status: "refused",
      reason: "identity-set",
    });
    expect(s.events).toEqual([]);
    expect(s.identities.personId).toBe("Ada Example");
  });

  it("stays anonymous when nobody is named, and writes no identity", async () => {
    const s = setup();
    const result = await s.on.execute("/w/repo", "none");
    expect(s.identities.writes).toBe(0);
    expect(result).toMatchObject({ status: "on", identity: { personId: null, previous: null } });
  });

  it("keeps the identity as it is, and names it", async () => {
    const s = setup();
    s.identities.personId = "Ada Example";
    const result = await s.on.execute("/w/repo", "keep");
    expect(s.identities.writes).toBe(0);
    expect(result).toMatchObject({
      identity: { personId: "Ada Example", previous: "Ada Example" },
    });
  });
});

describe("aidd telemetry off, kept as the end of an interval", () => {
  async function resolvedWhenGone(s: ReturnType<typeof setup>, cwd: string, at: string) {
    const run = await new DirectoryResolver(s.locator, s.consents, s.resolutions, s.history, {
      caseInsensitiveFileSystem: false,
      now: () => s.clock.now,
    }).open();
    return run.resolve(cwd, at);
  }

  it("closes the consent at its own time, and the clone's calls after it are refused", async () => {
    const s = setup();
    await s.on.execute("/w/repo", "keep");
    s.clock.now = new Date(T2);
    await s.off.execute("/w/repo");
    expect(s.history.written).toEqual([
      { kind: "open", token: "tok-1", clone: MAIN, at: T1 },
      { kind: "close", token: "tok-1", at: T2 },
    ]);
    // The working tree and the clone are gone; no ingest ran in between.
    s.consents.clones.delete(cloneKey(MAIN));
    s.resolutions.resolutions.set(resolutionKey("/gone/x", MAIN), deleted(MAIN));
    expect(await resolvedWhenGone(s, "/gone/x", T3)).toEqual({ skipped: "no-consent" });
    expect(await resolvedWhenGone(s, "/gone/x", T1)).toMatchObject({ stored: {} });
  });

  it("closes a consent whose key was already changed by hand", async () => {
    const s = setup();
    await s.on.execute("/w/repo", "keep");
    s.consents.values.set("/w/repo", "off");
    s.clock.now = new Date(T2);
    expect(await s.off.execute("/w/repo")).toEqual({ status: "off", changed: true });
    expect(s.history.written.at(-1)).toEqual({ kind: "close", token: "tok-1", at: T2 });
  });

  it("closes the interval its key names at its path, though the identity read there moved since `on`", async () => {
    const s = setup();
    await s.on.execute("/w/repo", "keep");
    // Where Linux refuses `statx`, the birth time is the change time, and `on` itself moved it.
    s.locator.directories.set("/w/repo", {
      ...repository("/w/repo", "/w/main"),
      clone: cloneOf("/w/main/.git", { birthtimeMs: 2_000 }),
    });
    s.clock.now = new Date(T2);
    await s.off.execute("/w/repo");
    expect(s.history.written.at(-1)).toEqual({ kind: "close", token: "tok-1", at: T2 });
  });

  it("leaves the interval of the clone a copy was made from, its key naming it at another path", async () => {
    const s = setup();
    await s.on.execute("/w/repo", "keep");
    s.locator.directories.set("/w/copy", repository("/w/copy"));
    s.consents.values.set("/w/copy", s.writes[0]?.value ?? "");
    await s.off.execute("/w/copy");
    expect(s.history.written.map((event) => event.kind)).toEqual(["open"]);
  });

  it("writes under the ledger's lock, the interval with the key", async () => {
    const s = setup();
    await s.on.execute("/w/repo", "keep");
    s.events.length = 0;
    await s.off.execute("/w/repo");
    expect(s.events).toEqual(["lock", "consent", "unlock"]);
  });

  it("writes nothing when there is no consent to close", async () => {
    const s = setup();
    await s.off.execute("/w/repo");
    expect(s.history.written).toEqual([]);
  });

  it("closes a consent once", async () => {
    const s = setup();
    await s.on.execute("/w/repo", "keep");
    await s.off.execute("/w/repo");
    await s.off.execute("/w/repo");
    expect(s.history.written.map((event) => event.kind)).toEqual(["open", "close"]);
  });

  it("still switches the key off for a clone the file system gives no identity", async () => {
    const s = setup();
    s.consents.values.set("/w/repo", "2:held");
    s.history.written.push({
      kind: "open",
      token: "theirs",
      clone: cloneOf("/w/other/.git"),
      at: T1,
    });
    s.locator.directories.set("/w/repo", { ...repository("/w/repo", "/w/main"), clone: null });
    expect(await s.off.execute("/w/repo")).toEqual({ status: "off", changed: true });
    expect(s.writes).toEqual([{ root: "/w/repo", value: "off" }]);
    expect(s.history.written).toHaveLength(1);
  });
});

describe("aidd telemetry off", () => {
  it("writes off over a granted consent", async () => {
    const s = setup();
    s.consents.values.set("/w/repo", "2:held");
    expect(await s.off.execute("/w/repo")).toEqual({ status: "off", changed: true });
    expect(s.writes).toEqual([{ root: "/w/repo", value: "off" }]);
  });

  it("writes nothing when there is nothing to switch off", async () => {
    const s = setup();
    expect(await s.off.execute("/w/repo")).toEqual({ status: "off", changed: false });
    s.consents.values.set("/w/repo", "off");
    expect(await s.off.execute("/w/repo")).toEqual({ status: "off", changed: false });
    expect(s.writes).toEqual([]);
  });

  it("refuses outside a repository, and a git config it cannot read", async () => {
    const s = setup();
    expect(await s.off.execute("/elsewhere")).toEqual({
      status: "refused",
      reason: "outside-repository",
    });
    s.consents.unreadable.add("/w/repo");
    expect(await s.off.execute("/w/repo")).toEqual({
      status: "refused",
      reason: "unreadable-git-config",
    });
    expect(s.writes).toEqual([]);
  });
});
