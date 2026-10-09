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
  const writes: { root: string; text: string }[] = [];
  const hooksSeen: string[] = [];
  const journalSeen: string[] = [];
  const on = new TelemetryOnUseCase(
    locator,
    consents,
    {
      async write(root, text) {
        events.push("config");
        writes.push({ root, text });
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
  const off = new TelemetryOffUseCase(locator, consents, {
    async write(root, text) {
      writes.push({ root, text });
    },
  });
  locator.directories.set("/w/repo", repository("/w/repo", "/w/main"));
  return { on, off, consents, ledger, resolutions, writes, events, hooksSeen, journalSeen };
}

describe("aidd telemetry on", () => {
  it("writes consent before it cleans, and cleans the repository it was run in", async () => {
    const s = setup();
    const result = await s.on.execute("/w/repo");
    expect(s.events.slice(0, 3)).toEqual(["config", "hooks", "journal"]);
    expect(s.writes).toHaveLength(1);
    expect(s.writes[0]?.root).toBe("/w/repo");
    expect(JSON.parse(s.writes[0]?.text ?? "")).toEqual({
      telemetry: { enabled: true, version: 2 },
    });
    expect(s.hooksSeen).toEqual(["/w/repo"]);
    expect(s.journalSeen).toEqual(["/w/repo"]);
    expect(result).toMatchObject({
      status: "on",
      configWritten: true,
      hook: { lineRemoved: true },
    });
  });

  it("still cleans, and writes nothing, when the project already granted this version", async () => {
    const s = setup();
    s.consents.texts.set("/w/repo", '{"telemetry":{"enabled":true,"version":2}}');
    const result = await s.on.execute("/w/repo");
    expect(s.writes).toEqual([]);
    expect(s.hooksSeen).toEqual(["/w/repo"]);
    expect(result).toMatchObject({ status: "on", configWritten: false });
  });

  it("refuses outside a repository without touching anything", async () => {
    const s = setup();
    expect(await s.on.execute("/elsewhere")).toEqual({
      status: "refused",
      reason: "outside-repository",
    });
    expect(s.events).toEqual([]);
  });

  it("refuses an unreadable config without touching anything", async () => {
    const s = setup();
    s.consents.texts.set("/w/repo", "{nope");
    expect(await s.on.execute("/w/repo")).toEqual({
      status: "refused",
      reason: "unreadable-config",
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
  it("writes enabled false and keeps the version", async () => {
    const s = setup();
    s.consents.texts.set("/w/repo", '{"telemetry":{"enabled":true,"version":2}}');
    expect(await s.off.execute("/w/repo")).toEqual({ status: "off", changed: true });
    expect(JSON.parse(s.writes[0]?.text ?? "")).toEqual({
      telemetry: { enabled: false, version: 2 },
    });
  });

  it("writes nothing when there is nothing to switch off", async () => {
    const s = setup();
    expect(await s.off.execute("/w/repo")).toEqual({ status: "off", changed: false });
    expect(s.writes).toEqual([]);
  });

  it("refuses outside a repository, and an unreadable config", async () => {
    const s = setup();
    expect(await s.off.execute("/elsewhere")).toEqual({
      status: "refused",
      reason: "outside-repository",
    });
    s.consents.texts.set("/w/repo", "[");
    expect(await s.off.execute("/w/repo")).toEqual({
      status: "refused",
      reason: "unreadable-config",
    });
    expect(s.writes).toEqual([]);
  });
});
