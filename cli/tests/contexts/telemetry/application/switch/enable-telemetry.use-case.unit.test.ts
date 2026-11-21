import { describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../../src/contexts/telemetry/application/directory-resolver.js";
import { RememberOwnRoot } from "../../../../../src/contexts/telemetry/application/switch/remember-own-root.use-case.js";
import {
  type RepositoryResolution,
  resolutionKey,
} from "../../../../../src/contexts/telemetry/domain/repository-resolution.js";
import { cloneOf } from "../../testing/clone.builder.js";
import {
  deleted,
  ID,
  MAIN,
  repository,
  setup,
  T1,
  T2,
  T3,
} from "../../testing/telemetry-switch.builder.js";

describe("aidd telemetry on", () => {
  it("writes consent for the repository it was run in", async () => {
    const s = setup();
    const result = await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    expect(s.events.slice(0, 3)).toEqual(["lock", "consent", "unlock"]);
    expect(s.writes).toEqual([{ root: "/w/repo", value: "2:tok-1" }]);
    expect(result).toMatchObject({ status: "on", consentWritten: true });
  });

  it("writes no consent when the clone already granted this version", async () => {
    const s = setup();
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    s.writes.length = 0;
    const result = await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    expect(s.writes).toEqual([]);
    expect(result).toMatchObject({ status: "on", consentWritten: false });
  });

  it("grants again over a withdrawn, a previous, a hand-set or a forged value", async () => {
    for (const value of ["off", "1", "true", "2", "2:forged"]) {
      const s = setup();
      s.consents.values.set("/w/repo", value);
      await s.on.execute({ cwd: "/w/repo", choice: "keep" });
      expect(s.writes).toEqual([{ root: "/w/repo", value: "2:tok-1" }]);
    }
  });

  it("mints a fresh token each time it opens an interval", async () => {
    const s = setup();
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    await s.off.execute({ cwd: "/w/repo" });
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    expect(s.writes.map((write) => write.value)).toEqual(["2:tok-1", "off", "2:tok-2"]);
  });

  it("refuses outside a repository without touching anything", async () => {
    const s = setup();
    expect(await s.on.execute({ cwd: "/elsewhere", choice: "keep" })).toEqual({
      status: "refused",
      reason: "outside-repository",
    });
    expect(s.events).toEqual([]);
  });

  it("refuses a repository git cannot read, as an unreadable git config, without touching anything", async () => {
    const s = setup();
    s.locator.directories.set("/w/broken", { status: "unreadable" });
    expect(await s.on.execute({ cwd: "/w/broken", choice: "keep" })).toEqual({
      status: "refused",
      reason: "unreadable-git-config",
    });
    expect(await s.off.execute({ cwd: "/w/broken" })).toEqual({
      status: "refused",
      reason: "unreadable-git-config",
    });
    expect(s.events).toEqual([]);
    expect(s.writes).toEqual([]);
  });

  it("refuses a git config it cannot read without touching anything", async () => {
    const s = setup();
    s.consents.unreadable.add("/w/repo");
    expect(await s.on.execute({ cwd: "/w/repo", choice: "keep" })).toEqual({
      status: "refused",
      reason: "unreadable-git-config",
    });
    expect(s.events).toEqual([]);
  });

  it("reads nothing back: the offsets are left as they are, and the root is remembered under the lock", async () => {
    const s = setup();
    s.ledger.stored.set("/t", { offset: 9, size: 9, identity: "i" });
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    expect(s.ledger.stored.size).toBe(1);
    expect(s.events.slice(3)).toEqual(["lock", "unlock"]);
  });

  it("remembers its own root, seen alive, so forget can find the clone later", async () => {
    const s = setup();
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
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
    await new RememberOwnRoot(s.ledger, s.resolutions, {
      caseInsensitiveFileSystem: false,
      now: () => new Date(T1),
    }).execute({ ...repository("/w/repo", "/w/main"), clone: null });
    expect(s.resolutions.saves).toBe(0);
  });

  it("opens the clone's interval at its own time, once", async () => {
    const s = setup();
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    s.clock.now = new Date(T2);
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    expect(s.history.written).toEqual([{ kind: "open", token: "tok-1", clone: MAIN, at: T1 }]);
  });

  it("opens the consent under the ledger's lock, with the key", async () => {
    const s = setup();
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    expect(s.events.slice(0, 3)).toEqual(["lock", "consent", "unlock"]);
  });

  it("refuses a clone the file system gives no identity, and changes nothing", async () => {
    const s = setup();
    s.locator.directories.set("/w/repo", { ...repository("/w/repo", "/w/main"), clone: null });
    expect(await s.on.execute({ cwd: "/w/repo", choice: "keep" })).toEqual({
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
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    expect(s.resolutions.saves).toBe(0);
  });

  describe("what a deleted directory is, after `on` in a clone", () => {
    async function resolvedAfterOn(
      s: ReturnType<typeof setup>,
      entry: RepositoryResolution,
      at = T3
    ) {
      s.resolutions.resolutions.set(resolutionKey(entry.dir, entry.clone), entry);
      await s.on.execute({ cwd: "/w/repo", choice: "keep" });
      return new DirectoryResolver({
        locator: s.locator,
        consentSource: s.consents,
        store: s.resolutions,
        history: s.history,
        environment: {
          caseInsensitiveFileSystem: false,
          now: () => s.clock.now,
        },
      }).execute(async (run) => run.resolve(entry.dir, at));
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
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    expect(s.resolutions.saves).toBe(1);
  });
});

describe("aidd telemetry on, given who the clone is measured as", () => {
  it("writes the identity chosen once the clone is on, and names it", async () => {
    const s = setup();
    const result = await s.on.execute({ cwd: "/w/repo", choice: { set: " Ada Example " } });
    expect(s.identities.personId).toBe("Ada Example");
    expect(result).toMatchObject({
      status: "on",
      identity: { personId: "Ada Example", previous: null },
    });
  });

  it("replaces the identity already set, and names the previous one", async () => {
    const s = setup();
    s.identities.personId = "Ada at Home";
    const result = await s.on.execute({ cwd: "/w/repo", choice: { set: "Ada Example" } });
    expect(s.identities.personId).toBe("Ada Example");
    expect(result).toMatchObject({
      identity: { personId: "Ada Example", previous: "Ada at Home" },
    });
  });

  it("writes no identity when the clone is refused, whatever was chosen", async () => {
    const s = setup();
    s.locator.directories.set("/w/repo", { ...repository("/w/repo", "/w/main"), clone: null });
    for (const cwd of ["/elsewhere", "/w/repo"]) {
      expect(await s.on.execute({ cwd: cwd, choice: { set: "Ada Example" } })).toMatchObject({
        status: "refused",
      });
    }
    expect(s.identities.writes).toBe(0);
    expect(s.writes).toEqual([]);
  });

  it("writes no identity when the consent log cannot be trusted", async () => {
    const s = setup();
    s.history.damaged = true;
    expect(await s.on.execute({ cwd: "/w/repo", choice: { set: "Ada Example" } })).toEqual({
      status: "refused",
      reason: "damaged-consent-log",
    });
    expect(s.identities.writes).toBe(0);
  });

  it("refuses an identifier the identity rules refuse, before writing anything", async () => {
    for (const typed of ["  ", "Ada\nExample", "a".repeat(129)]) {
      const s = setup();
      expect(await s.on.execute({ cwd: "/w/repo", choice: { set: typed } })).toEqual({
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
    expect(await s.on.execute({ cwd: "/w/repo", choice: "none" })).toEqual({
      status: "refused",
      reason: "identity-set",
    });
    expect(s.events).toEqual([]);
    expect(s.identities.personId).toBe("Ada Example");
  });

  it("stays anonymous when nobody is named, and writes no identity", async () => {
    const s = setup();
    const result = await s.on.execute({ cwd: "/w/repo", choice: "none" });
    expect(s.identities.writes).toBe(0);
    expect(result).toMatchObject({ status: "on", identity: { personId: null, previous: null } });
  });

  it("keeps the identity as it is, and names it", async () => {
    const s = setup();
    s.identities.personId = "Ada Example";
    const result = await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    expect(s.identities.writes).toBe(0);
    expect(result).toMatchObject({
      identity: { personId: "Ada Example", previous: "Ada Example" },
    });
  });
});
