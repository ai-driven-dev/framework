import { describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../../src/contexts/telemetry/application/directory-resolver.js";
import { cloneKey } from "../../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { resolutionKey } from "../../../../../src/contexts/telemetry/domain/repository-resolution.js";
import { deleted, MAIN, setup, T1, T2, T3 } from "../../testing/telemetry-switch.builder.js";

describe("aidd telemetry off, kept as the end of an interval", () => {
  async function resolvedWhenGone(s: ReturnType<typeof setup>, cwd: string, at: string) {
    return new DirectoryResolver(s.locator, s.consents, s.resolutions, s.history, {
      caseInsensitiveFileSystem: false,
      now: () => s.clock.now,
    }).execute(async (run) => run.resolve(cwd, at));
  }

  it("closes the consent at its own time, and the clone's calls after it are refused", async () => {
    const s = setup();
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    s.clock.now = new Date(T2);
    await s.off.execute({ cwd: "/w/repo" });
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
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    s.consents.values.set("/w/repo", "off");
    s.clock.now = new Date(T2);
    expect(await s.off.execute({ cwd: "/w/repo" })).toEqual({ status: "off", changed: true });
    expect(s.history.written.at(-1)).toEqual({ kind: "close", token: "tok-1", at: T2 });
  });

  it("writes under the ledger's lock, the interval with the key", async () => {
    const s = setup();
    await s.on.execute({ cwd: "/w/repo", choice: "keep" });
    s.events.length = 0;
    await s.off.execute({ cwd: "/w/repo" });
    expect(s.events).toEqual(["lock", "consent", "unlock"]);
  });
});

describe("aidd telemetry off", () => {
  it("writes off over a granted consent", async () => {
    const s = setup();
    s.consents.values.set("/w/repo", "2:held");
    expect(await s.off.execute({ cwd: "/w/repo" })).toEqual({ status: "off", changed: true });
    expect(s.writes).toEqual([{ root: "/w/repo", value: "off" }]);
  });

  it("writes nothing when there is nothing to switch off", async () => {
    const s = setup();
    expect(await s.off.execute({ cwd: "/w/repo" })).toEqual({ status: "off", changed: false });
    s.consents.values.set("/w/repo", "off");
    expect(await s.off.execute({ cwd: "/w/repo" })).toEqual({ status: "off", changed: false });
    expect(s.writes).toEqual([]);
  });

  it("refuses outside a repository, and a git config it cannot read", async () => {
    const s = setup();
    expect(await s.off.execute({ cwd: "/elsewhere" })).toEqual({
      status: "refused",
      reason: "outside-repository",
    });
    s.consents.unreadable.add("/w/repo");
    expect(await s.off.execute({ cwd: "/w/repo" })).toEqual({
      status: "refused",
      reason: "unreadable-git-config",
    });
    expect(s.writes).toEqual([]);
  });
});
