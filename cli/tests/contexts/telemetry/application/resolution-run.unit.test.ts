import { describe, expect, it } from "vitest";
import { ResolutionRun } from "../../../../src/contexts/telemetry/application/resolution-run.js";
import { cloneKey } from "../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { ConsentLog } from "../../../../src/contexts/telemetry/domain/consent/consent-log.js";
import { RememberedResolutions } from "../../../../src/contexts/telemetry/domain/remembered-resolutions.js";
import { resolutionKey } from "../../../../src/contexts/telemetry/domain/repository-resolution.js";
import { cloneOf, grantedBy, tokenOf } from "../testing/clone.builder.js";
import { FakeConsents } from "../testing/fake-consents.fake.js";
import { FakeLocator } from "../testing/fake-locator.fake.js";
import { A, repository } from "../testing/ingest-usage-setup.builder.js";

const OPENED = "2026-01-01T00:00:00.000Z";
const CLOSED = "2026-02-01T00:00:00.000Z";
const CALL = "2026-03-01T00:00:00.000Z";
const DIR = "/work/a";
const sighting = {
  dir: DIR,
  repository_id: "r",
  root: DIR,
  clone: A,
  seen_at: OPENED,
};

function world(
  options: {
    events?: ConstructorParameters<typeof ConsentLog>[0]["events"];
    damaged?: boolean;
    remembered?: boolean;
    unreadable?: readonly string[];
  } = {}
) {
  const locator = new FakeLocator();
  const consents = new FakeConsents();
  const remembered = new RememberedResolutions(
    new Map(options.remembered ? [[resolutionKey(DIR, A), sighting]] : [])
  );
  const run = new ResolutionRun(
    locator,
    consents,
    { caseInsensitiveFileSystem: false, now: () => new Date(CALL) },
    {
      remembered,
      consents: new ConsentLog({ events: options.events ?? [], damaged: options.damaged ?? false }),
      unreadable: new Set(options.unreadable ?? []),
    }
  );
  return { run, locator, consents };
}

const opened = [{ kind: "open", token: tokenOf(A), clone: A, at: OPENED }] as const;
const closed = [...opened, { kind: "close", token: tokenOf(A), at: CLOSED }] as const;

describe("what a run says of the directory a call was made in", () => {
  it("stores a call made in a live directory of a clone that consented, and remembers it", async () => {
    const { run, locator } = world({ events: opened });
    locator.directories.set(DIR, repository(DIR));
    const outcome = await run.resolve(DIR, CALL);
    expect(outcome).toMatchObject({ stored: { dir: DIR, clone: A }, live: true });
    expect(run.learned.changed).toBe(true);
  });

  it("refuses a directory outside any repository", async () => {
    const { run, locator } = world({ events: opened });
    locator.directories.set(DIR, { status: "outside-repository" });
    expect(await run.resolve(DIR, CALL)).toEqual({ skipped: "outside-repo" });
  });

  it("refuses a gone directory no run ever saw alive, and stores one it did", async () => {
    expect(await world({ events: opened }).run.resolve(DIR, CALL)).toEqual({
      skipped: "never-seen-alive",
    });
    const seen = world({ events: opened, remembered: true });
    expect(await seen.run.resolve(DIR, CALL)).toMatchObject({ stored: { dir: DIR }, live: false });
  });

  it("refuses a call made before the clone consented", async () => {
    const { run, locator } = world({ events: opened });
    locator.directories.set(DIR, repository(DIR));
    expect(await run.resolve(DIR, "2025-12-01T00:00:00.000Z")).toEqual({ skipped: "no-consent" });
  });

  it("tells a consent that was closed from one that never was, only for a live clone", async () => {
    const never = world({ events: closed });
    never.locator.directories.set(DIR, repository(DIR));
    expect(await never.run.resolve(DIR, CALL)).toEqual({ skipped: "no-consent" });
    const named = world({ events: closed });
    named.locator.directories.set(DIR, repository(DIR));
    named.consents.cloneSays(A, grantedBy(A));
    expect(await named.run.resolve(DIR, CALL)).toEqual({ skipped: "consent-closed" });
  });

  it("does not tell a closed consent of a clone that is gone", async () => {
    const gone = world({ events: closed, remembered: true });
    gone.consents.cloneSays(A, grantedBy(A));
    expect(await gone.run.resolve(DIR, CALL)).toEqual({ skipped: "no-consent" });
  });

  it("holds a verdict back when the clone's git config could not be read", async () => {
    const { run, locator } = world({ events: opened, remembered: true, unreadable: [cloneKey(A)] });
    locator.directories.set(DIR, repository(DIR));
    expect(await run.resolve(DIR, CALL)).toEqual({
      skipped: "unreadable-consent",
      mayConsent: true,
    });
  });

  it("says whether an unreadable directory could still turn out to be a consenting clone", async () => {
    const readable = world({ events: opened, remembered: true });
    readable.locator.directories.set(DIR, { status: "unreadable" });
    expect(await readable.run.resolve(DIR, CALL)).toEqual({
      skipped: "unreadable-consent",
      mayConsent: true,
    });
    const unknown = world({ events: opened });
    unknown.locator.directories.set(DIR, { status: "unreadable" });
    expect(await unknown.run.resolve(DIR, CALL)).toEqual({
      skipped: "unreadable-consent",
      mayConsent: false,
    });
    const before = world({ events: opened, remembered: true });
    before.locator.directories.set(DIR, { status: "unreadable" });
    expect(await before.run.resolve(DIR, "2025-12-01T00:00:00.000Z")).toMatchObject({
      mayConsent: false,
    });
  });

  it("says nothing for any clone while the consent log is damaged", async () => {
    const { run, locator } = world({ events: opened, damaged: true, remembered: true });
    locator.directories.set(DIR, repository(DIR));
    expect(await run.resolve(DIR, CALL)).toEqual({
      skipped: "unreadable-consent",
      mayConsent: false,
    });
    expect(run.consentLogDamaged).toBe(true);
    expect(run.coveredFrom).toBe(Number.NEGATIVE_INFINITY);
  });

  it("covers calls from the first interval, and holds the moment of the run", () => {
    const { run } = world({ events: opened });
    expect(run.coveredFrom).toBe(Date.parse(OPENED));
    expect(run.now).toBe(CALL);
    expect(run.consentLogDamaged).toBe(false);
  });

  it("asks the locator once of a directory it was asked of twice", async () => {
    const { run, locator } = world({ events: opened });
    locator.directories.set(DIR, repository(DIR));
    await run.resolve(DIR, CALL);
    await run.resolve(DIR, CALL);
    expect(locator.asked).toEqual([DIR]);
  });

  it("tells two clones made at one path apart", async () => {
    const other = cloneOf(A.path, { ino: "8" });
    const { run, locator } = world({
      events: [{ kind: "open", token: tokenOf(other), clone: other, at: OPENED }],
    });
    locator.directories.set(DIR, repository(DIR));
    expect(await run.resolve(DIR, CALL)).toEqual({ skipped: "no-consent" });
  });
});
