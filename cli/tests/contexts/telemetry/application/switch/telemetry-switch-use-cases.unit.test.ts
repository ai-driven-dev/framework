import { describe, expect, it } from "vitest";
import { TelemetryOffUseCase } from "../../../../../src/contexts/telemetry/application/switch/telemetry-off-use-case.js";
import { TelemetryOnUseCase } from "../../../../../src/contexts/telemetry/application/switch/telemetry-on-use-case.js";
import type { LocatedDirectory } from "../../../../../src/contexts/telemetry/domain/ports/repository-locator.js";
import {
  FakeConsents,
  FakeLocator,
  InMemoryLedger,
  InMemoryResolutions,
} from "../../../../helpers/ports/in-memory-telemetry.js";

const NO_HOOK = { lineRemoved: false, delegateRemoved: false, stillCalledBy: [] };
const NO_JOURNAL = { journalRemoved: false, trackedKept: false, ignoreEntryRemoved: false };
const repository = (root: string, mainRoot = root): LocatedDirectory => ({
  status: "repository",
  root,
  mainRoot,
  remote: "r",
  rootCommit: "c",
});

function setup(settings: (string | null)[] = []) {
  const events: string[] = [];
  const locator = new FakeLocator();
  const consents = new FakeConsents();
  const ledger = new InMemoryLedger(events);
  const resolutions = new InMemoryResolutions();
  const writes: { root: string; value: string }[] = [];
  const config = {
    texts: new Map<string, string>(),
    written: [] as { root: string; text: string }[],
    removed: [] as string[],
  };
  const hooksSeen: string[] = [];
  const journalSeen: string[] = [];
  const writer = {
    async set(root: string, value: string) {
      events.push("consent");
      writes.push({ root, value });
      consents.values.set(root, value);
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
    { texts: async () => settings },
    false
  );
  const off = new TelemetryOffUseCase(locator, consents, writer);
  locator.directories.set("/w/repo", repository("/w/repo", "/w/main"));
  return {
    on,
    off,
    consents,
    ledger,
    resolutions,
    writes,
    config,
    events,
    hooksSeen,
    journalSeen,
  };
}

describe("aidd telemetry on", () => {
  it("writes consent before it cleans, and cleans the repository it was run in", async () => {
    const s = setup();
    const result = await s.on.execute("/w/repo");
    expect(s.events.slice(0, 3)).toEqual(["consent", "hooks", "journal"]);
    expect(s.writes).toEqual([{ root: "/w/repo", value: "2" }]);
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
    s.consents.values.set("/w/repo", "2");
    const result = await s.on.execute("/w/repo");
    expect(s.writes).toEqual([]);
    expect(s.hooksSeen).toEqual(["/w/repo"]);
    expect(result).toMatchObject({ status: "on", consentWritten: false });
  });

  it("grants again over a withdrawn or a previous value", async () => {
    for (const value of ["off", "1", "true"]) {
      const s = setup();
      s.consents.values.set("/w/repo", value);
      await s.on.execute("/w/repo");
      expect(s.writes).toEqual([{ root: "/w/repo", value: "2" }]);
    }
  });

  it("removes the previous version's block from .aidd/config.json and keeps the rest", async () => {
    const s = setup();
    s.config.texts.set(
      "/w/repo",
      '{\n  "keep": 1,\n  "telemetry": { "enabled": true, "endpoint": "x" }\n}\n'
    );
    const result = await s.on.execute("/w/repo");
    expect(result).toMatchObject({ legacyConfig: "block-removed" });
    expect(s.config.written).toEqual([{ root: "/w/repo", text: '{\n  "keep": 1\n}\n' }]);
    expect(s.config.removed).toEqual([]);
  });

  it("deletes .aidd/config.json when the block was all it held", async () => {
    const s = setup();
    s.config.texts.set("/w/repo", '{"telemetry":{"enabled":true,"endpoint":"x"}}');
    expect(await s.on.execute("/w/repo")).toMatchObject({ legacyConfig: "file-deleted" });
    expect(s.config.removed).toEqual(["/w/repo"]);
    expect(s.config.written).toEqual([]);
  });

  it("leaves a config that does not parse alone, and still turns measurement on", async () => {
    const s = setup();
    s.config.texts.set("/w/repo", "{nope");
    expect(await s.on.execute("/w/repo")).toMatchObject({
      consentWritten: true,
      legacyConfig: "unparseable",
    });
    expect(s.config.written).toEqual([]);
    expect(s.config.removed).toEqual([]);
  });

  it("never reads .aidd/config.json as consent", async () => {
    const s = setup();
    s.config.texts.set("/w/repo", '{"telemetry":{"enabled":true,"version":2}}');
    const result = await s.on.execute("/w/repo");
    expect(result).toMatchObject({ consentWritten: true });
    expect(s.writes).toEqual([{ root: "/w/repo", value: "2" }]);
  });

  it("refuses outside a repository without touching anything", async () => {
    const s = setup();
    expect(await s.on.execute("/elsewhere")).toEqual({
      status: "refused",
      reason: "outside-repository",
    });
    expect(s.events).toEqual([]);
  });

  it("refuses a git config it cannot read without touching anything", async () => {
    const s = setup();
    s.consents.unreadable.add("/w/repo");
    expect(await s.on.execute("/w/repo")).toEqual({
      status: "refused",
      reason: "unreadable-git-config",
    });
    expect(s.events).toEqual([]);
  });

  it("resets the offsets and grants the remembered roots under the ledger's lock, after cleaning", async () => {
    const s = setup();
    s.ledger.stored.set("/t", { offset: 9, size: 9, identity: "i" });
    s.resolutions.resolutions.set("/gone/a", {
      repository_id: "r",
      root: "/w/repo",
      consented: false,
    });
    s.resolutions.resolutions.set("/gone/m", {
      repository_id: "r",
      root: "/w/main",
      consented: false,
    });
    s.resolutions.resolutions.set("/gone/o", {
      repository_id: "o",
      root: "/w/other",
      consented: false,
    });
    await s.on.execute("/w/repo");
    expect(s.events.slice(3)).toEqual(["lock", "reset", "unlock"]);
    expect(s.ledger.stored.size).toBe(0);
    expect(s.resolutions.saves).toBe(1);
    expect(s.resolutions.resolutions.get("/gone/a")?.consented).toBe(true);
    expect(s.resolutions.resolutions.get("/gone/m")?.consented).toBe(true);
    expect(s.resolutions.resolutions.get("/gone/o")?.consented).toBe(false);
  });

  it("grants the remembered refusal of a linked worktree deleted before the opt-in", async () => {
    const s = setup();
    // The repository's id is its root commit here; the worktree is neither root `on` knows.
    s.resolutions.resolutions.set("/gone/wt", {
      repository_id: "c",
      root: "/w/repo-wt-deleted",
      consented: false,
    });
    await s.on.execute("/w/repo");
    expect(s.resolutions.resolutions.get("/gone/wt")?.consented).toBe(true);
  });

  it("does not rewrite the remembered roots when none needed granting", async () => {
    const s = setup();
    await s.on.execute("/w/repo");
    expect(s.resolutions.saves).toBe(0);
  });

  it.each([
    [[null, null, null], 30, true],
    [[null, '{"cleanupPeriodDays":3650}', null], 3650, false],
    [['{"cleanupPeriodDays":3649}', '{"cleanupPeriodDays":3650}'], 3649, true],
  ])("reports retention from %j", async (settings, days, short) => {
    const s = setup(settings as (string | null)[]);
    expect(await s.on.execute("/w/repo")).toMatchObject({ retention: { days, short } });
  });
});

describe("aidd telemetry off", () => {
  it("writes off over a granted consent", async () => {
    const s = setup();
    s.consents.values.set("/w/repo", "2");
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
