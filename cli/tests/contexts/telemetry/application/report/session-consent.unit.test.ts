import { describe, expect, it } from "vitest";
import { DirectoryResolver } from "../../../../../src/contexts/telemetry/application/directory-resolver.js";
import { SessionConsent } from "../../../../../src/contexts/telemetry/application/report/session-consent.js";
import { cloneKey } from "../../../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import { resolutionKey } from "../../../../../src/contexts/telemetry/domain/repository-resolution.js";
import { consentValue } from "../../../../../src/contexts/telemetry/domain/telemetry-consent.js";
import {
  cloneOf,
  FakeConsents,
  FakeLocator,
  grantedBy,
  InMemoryConsentHistory,
  InMemoryLedger,
  InMemoryResolutions,
} from "../../../../helpers/ports/in-memory-telemetry.js";

const cwd = "/work/repo";
const repo = "repository-one";
const at = "2026-10-07T10:30:00.000Z";
const start = "2026-10-07T10:00:00.000Z";
const admission = { feature: { state: "unbound" as const }, cwd, repositoryId: repo };

function setup(history = new InMemoryConsentHistory()) {
  const ledger = new InMemoryLedger();
  const locator = new FakeLocator();
  const source = new FakeConsents();
  const resolutions = new InMemoryResolutions();
  const clone = cloneOf(`${cwd}/.git`);
  locator.directories.set(cwd, {
    status: "repository",
    root: cwd,
    mainRoot: cwd,
    clone,
    remote: null,
    rootCommit: repo,
  });
  source.cloneSays(clone, grantedBy(clone));
  history.consented(clone, "2026-10-07T09:00:00.000Z");
  const directories = new DirectoryResolver(locator, source, resolutions, history, {
    caseInsensitiveFileSystem: false,
    now: () => new Date("2026-10-07T12:00:00.000Z"),
  });
  return {
    checker: new SessionConsent(ledger, directories, history),
    ledger,
    locator,
    source,
    resolutions,
    history,
    clone,
  };
}

describe("consent for an observed session", () => {
  it("proves the consented clone and refuses a replacement at the same path", async () => {
    const s = setup();
    const original = await s.checker.proof(admission, at, start, "2026-10-07T11:00:00.000Z");
    expect(original).toMatch(/^[a-f0-9]{64}$/);
    expect(await s.checker.proof(admission, at, start, "2026-10-07T11:00:00.000Z")).toBe(original);
    const replacement = cloneOf(`${cwd}/.git`, {
      ino: "9",
      birthtimeMs: Date.parse("2026-10-07T10:45:00.000Z"),
    });
    s.locator.directories.set(cwd, {
      status: "repository",
      root: cwd,
      mainRoot: cwd,
      clone: replacement,
      remote: null,
      rootCommit: repo,
    });
    s.history.consented(replacement, "2026-10-07T10:45:00.000Z");
    s.source.cloneSays(replacement, grantedBy(replacement));
    expect(await s.checker.proof(admission, at, start, "2026-10-07T11:00:00.000Z")).toBeNull();
  });

  it("allows an instant or whole interval only inside one clone's consent", async () => {
    const s = setup();
    expect(await s.checker.permits(admission, at)).toBe("allow");
    expect(await s.checker.permits(admission, at, start)).toBe("allow");
    expect(s.ledger.events).toEqual(["lock", "unlock", "lock", "unlock"]);
  });

  it("rejects a cumulative interval crossing an opt-out even after opt-in resumes", async () => {
    const s = setup();
    const first = s.history.written[0];
    if (first?.kind !== "open") throw new Error("Missing initial consent");
    s.history.written.push(
      { kind: "close", token: first.token, at: "2026-10-07T10:15:00.000Z" },
      { kind: "open", token: "new-consent", clone: s.clone, at: "2026-10-07T10:20:00.000Z" }
    );
    s.source.cloneSays(s.clone, consentValue("new-consent"));
    expect(await s.checker.permits(admission, at, start)).toBe("deny");
    expect(await s.checker.permits(admission, start, undefined, at)).toBe("allow");
    expect(await s.checker.permits(admission, at, "2026-10-07T10:20:00.000Z")).toBe("allow");
    expect(await s.checker.permits(admission, "2026-10-07T10:15:00.000Z", start)).toBe("deny");
  });

  it("denies a window spanning two different clones at the same path", async () => {
    const s = setup();
    const newClone = cloneOf(`${cwd}/.git`, {
      ino: "8",
      birthtimeMs: Date.parse("2026-10-07T10:15:00.000Z"),
    });
    s.resolutions.resolutions.set(resolutionKey(cwd, s.clone), {
      dir: cwd,
      root: cwd,
      repository_id: repo,
      clone: s.clone,
      seen_at: "2026-10-07T09:00:00.000Z",
    });
    s.locator.directories.set(cwd, {
      status: "repository",
      root: cwd,
      mainRoot: cwd,
      clone: newClone,
      remote: null,
      rootCommit: repo,
    });
    s.history.consented(newClone, "2026-10-07T10:15:00.000Z");
    s.source.cloneSays(newClone, grantedBy(newClone));
    expect(await s.checker.permits(admission, at, start)).toBe("deny");
    expect(await s.checker.permits(admission, at)).toBe("allow");
    expect(await s.checker.permits(admission, start, undefined, at)).toBe("deny");
  });

  it("denies a repository other than the session's admitted repository", async () => {
    const s = setup();
    expect(await s.checker.permits({ ...admission, repositoryId: "other" }, at)).toBe("deny");
  });

  it("allows unlinked token observations without a repository only for the same consented clone", async () => {
    const s = setup();
    const uncertain = { ...admission, repositoryId: null };
    expect(await s.checker.permits(uncertain, at, start)).toBe("allow");
    expect(
      await s.checker.permits(
        { ...uncertain, feature: { state: "confirmed", feature: "owner/repo#1", branch: "work" } },
        at
      )
    ).toBe("unknown");
    const replacement = cloneOf(`${cwd}/.git`, {
      ino: "9",
      birthtimeMs: Date.parse("2026-10-07T10:45:00.000Z"),
    });
    s.resolutions.resolutions.set(resolutionKey(cwd, s.clone), {
      dir: cwd,
      root: cwd,
      repository_id: repo,
      clone: s.clone,
      seen_at: "2026-10-07T09:00:00.000Z",
    });
    s.locator.directories.set(cwd, {
      status: "repository",
      root: cwd,
      mainRoot: cwd,
      clone: replacement,
      remote: null,
      rootCommit: repo,
    });
    s.history.consented(replacement, "2026-10-07T10:45:00.000Z");
    s.source.cloneSays(replacement, grantedBy(replacement));
    expect(await s.checker.permits(uncertain, at, undefined, "2026-10-07T11:00:00.000Z")).toBe(
      "deny"
    );
  });

  it.each(["start", "end"] as const)(
    "keeps a window unknown when its %s is unreadable and its other end is denied",
    async (unreadable) => {
      const s = setup();
      const newClone = cloneOf(`${cwd}/.git`, {
        ino: "8",
        birthtimeMs: Date.parse("2026-10-07T10:15:00.000Z"),
      });
      s.resolutions.resolutions.set(resolutionKey(cwd, s.clone), {
        dir: cwd,
        root: cwd,
        repository_id: repo,
        clone: s.clone,
        seen_at: "2026-10-07T09:00:00.000Z",
      });
      s.locator.directories.set(cwd, {
        status: "repository",
        root: cwd,
        mainRoot: cwd,
        clone: newClone,
        remote: null,
        rootCommit: repo,
      });
      const initial = s.history.written[0];
      if (initial?.kind !== "open") throw new Error("Missing initial consent");
      if (unreadable === "end")
        s.history.written[0] = { ...initial, at: "2026-10-07T10:10:00.000Z" };
      s.history.consented(
        newClone,
        unreadable === "start" ? "2026-10-07T10:45:00.000Z" : "2026-10-07T10:20:00.000Z"
      );
      s.source.cloneSays(newClone, grantedBy(newClone));
      const unavailableClone = unreadable === "start" ? s.clone : newClone;
      s.source.unreadableClones.add(cloneKey(unavailableClone));
      expect(await s.checker.permits(admission, at, start)).toBe("unknown");
      expect(await s.checker.permits(admission, start)).toBe(
        unreadable === "start" ? "unknown" : "deny"
      );
      expect(await s.checker.permits(admission, at)).toBe(
        unreadable === "end" ? "unknown" : "deny"
      );
      expect(s.ledger.events).toEqual(["lock", "unlock", "lock", "unlock", "lock", "unlock"]);
    }
  );

  it.each([
    [{ ...admission, cwd: null }, at, undefined],
    [{ ...admission, cwd: "" }, at, undefined],
    [admission, "invalid", undefined],
    [admission, at, "invalid"],
    [admission, start, at],
  ])(
    "leaves incomplete or inconsistent evidence unknown without reading the ledger",
    async (a, end, from) => {
      const s = setup();
      expect(await s.checker.permits(a, end, from)).toBe("unknown");
      expect(s.ledger.exclusiveRuns).toBe(0);
    }
  );

  it.each([
    ["gone", "unknown"],
    ["unreadable", "unknown"],
    ["outside-repository", "deny"],
  ] as const)("does not permit an unresolved %s directory", async (status, expected) => {
    const s = setup();
    s.locator.directories.set(cwd, { status });
    expect(await s.checker.permits(admission, at)).toBe(expected);
  });

  it("denies a clone without consent, and treats damaged history as unknown", async () => {
    const s = setup();
    s.history.written.length = 0;
    expect(await s.checker.permits(admission, at)).toBe("deny");
    s.history.damaged = true;
    expect(await s.checker.permits(admission, at)).toBe("unknown");
  });

  it("does not authorize when the history becomes damaged after directory resolution", async () => {
    class BecomesDamaged extends InMemoryConsentHistory {
      calls = 0;
      override async read() {
        const result = await super.read();
        return { ...result, damaged: ++this.calls > 1 };
      }
    }
    const s = setup(new BecomesDamaged());
    expect(await s.checker.permits(admission, at)).toBe("unknown");
    expect(s.resolutions.saves).toBe(1);
    expect(s.ledger.events).toEqual(["lock", "unlock"]);
  });

  it("closes directory resolution and releases the lock when the history read fails", async () => {
    class FailsOnRecheck extends InMemoryConsentHistory {
      calls = 0;
      override async read() {
        if (++this.calls > 1) throw new Error("history unavailable");
        return super.read();
      }
    }
    const s = setup(new FailsOnRecheck());
    await expect(s.checker.permits(admission, at)).rejects.toThrow("history unavailable");
    expect(s.resolutions.saves).toBe(1);
    expect(s.ledger.events).toEqual(["lock", "unlock"]);
  });
});
