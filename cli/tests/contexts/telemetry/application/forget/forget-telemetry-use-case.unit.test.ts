import { describe, expect, it } from "vitest";
import { ForgetTelemetryUseCase } from "../../../../../src/contexts/telemetry/application/forget/forget-telemetry-use-case.js";
import type { BranchSnapshot } from "../../../../../src/contexts/telemetry/domain/branch-binding.js";
import type { ErasureEntry } from "../../../../../src/contexts/telemetry/domain/ports/forget/measurement-erasure.js";
import type { LocatedDirectory } from "../../../../../src/contexts/telemetry/domain/ports/repository-locator.js";
import { repositoryIdOf } from "../../../../../src/contexts/telemetry/domain/repository-identity.js";
import { resolutionKey } from "../../../../../src/contexts/telemetry/domain/repository-resolution.js";
import {
  cloneOf,
  InMemoryConsentHistory,
  InMemoryLedger,
  InMemoryResolutions,
  InMemorySnapshots,
} from "../../../../helpers/ports/in-memory-telemetry.js";

const located = (
  root: string,
  remote = "https://github.com/acme/widgets.git",
  mainRoot = root
): Extract<LocatedDirectory, { status: "repository" }> => ({
  status: "repository",
  root,
  mainRoot,
  clone: cloneOf(`${mainRoot}/.git`),
  remote,
  rootCommit: "c",
});
const ID = repositoryIdOf(located("/x")) ?? "";
const snapshot = (id: string): BranchSnapshot => ({
  repository_id: id,
  branch: "main",
  task: "t",
  ticket: null,
  declared_at: "2026-10-07T10:00:00Z",
  none: false,
  branch_created_at: null,
  snapshot_at: "2026-10-07T10:00:00Z",
});
const ENTRY: ErasureEntry = { kind: "ledger", path: "/t/ledger", files: 2 };

function setup(entries: ErasureEntry[] = [ENTRY]) {
  const events: string[] = [];
  const history = new InMemoryConsentHistory();
  const snapshots = new InMemorySnapshots(events);
  const resolutions = new InMemoryResolutions();
  const ledger = new InMemoryLedger(events);
  const cleared: string[] = [];
  /** The clones that exist, with the task keys they hold. */
  const keys = new Map<string, number>();
  const consented = new Set<string>();
  const use = new ForgetTelemetryUseCase(
    {
      async inventory() {
        events.push("inventory");
        return entries;
      },
      async erase() {
        events.push("erase");
      },
    },
    {
      async count(clone) {
        const taskKeys = keys.get(clone);
        return taskKeys === undefined ? null : { taskKeys, consent: consented.has(clone) };
      },
      async clear(clone) {
        events.push(`clear ${clone}`);
        cleared.push(clone);
        return { taskKeys: keys.get(clone) ?? 0, consent: consented.has(clone) };
      },
    },
    snapshots,
    resolutions,
    history,
    ledger
  );
  return { use, events, history, snapshots, resolutions, ledger, cleared, keys, consented };
}

const CLONE = "/w/repo/.git";

/** A directory remembered with its clone, which exists and holds `taskKeys` task keys. Whether
 * the clone ever consented is told apart: `consenting` gives it an interval. */
function remember(
  s: ReturnType<typeof setup>,
  cwd: string,
  clone = CLONE,
  extra: { consenting?: boolean; taskKeys?: number } = {}
): void {
  const identity = cloneOf(clone);
  s.resolutions.resolutions.set(resolutionKey(cwd, identity), {
    dir: cwd,
    repository_id: ID,
    root: cwd,
    clone: identity,
    seen_at: "2026-10-01T00:00:00.000Z",
  });
  if (extra.consenting) s.history.consented(identity);
  s.keys.set(clone, extra.taskKeys ?? 0);
}

function declaredAt(s: ReturnType<typeof setup>, taskKeys = 3): void {
  s.snapshots.appended.push(snapshot(ID));
  remember(s, "/w/repo", CLONE, { taskKeys });
}

describe("forget without confirmation", () => {
  it("previews what would go and takes no lock and removes nothing", async () => {
    const s = setup();
    declaredAt(s);
    const result = await s.use.execute(false);
    expect(result).toEqual({
      status: "preview",
      plan: {
        entries: [ENTRY],
        repositories: [{ clone: CLONE, taskKeys: 3, consent: false }],
        missing: [],
        unlocated: 0,
      },
    });
    expect(s.events).not.toContain("lock");
    expect(s.events).not.toContain("erase");
    expect(s.cleared).toEqual([]);
  });
});

describe("forget with confirmation", () => {
  it("holds the ledger lock, clears the declarations, then erases, and reports what it found under the lock", async () => {
    const s = setup();
    declaredAt(s);
    const result = await s.use.execute(true);
    const locked = s.events.slice(s.events.indexOf("lock"));
    expect(locked).toEqual(["lock", "inventory", `clear ${CLONE}`, "erase", "unlock"]);
    expect(result.status).toBe("forgotten");
    expect(result.plan.repositories).toEqual([{ clone: CLONE, taskKeys: 3, consent: false }]);
  });

  it("clears the consent of a clone `on` remembered, though no session ever ran there", async () => {
    const s = setup();
    remember(s, "/w/repo", CLONE, { consenting: true });
    s.consented.add(CLONE);
    const result = await s.use.execute(true);
    expect(s.cleared).toEqual([CLONE]);
    expect(result.plan.repositories).toEqual([{ clone: CLONE, taskKeys: 0, consent: true }]);
  });

  it("clears a withdrawn consent too, whatever the clone consented to", async () => {
    const s = setup();
    remember(s, "/w/repo", CLONE, { consenting: false });
    s.consented.add(CLONE);
    await s.use.execute(true);
    expect(s.cleared).toEqual([CLONE]);
  });

  it("takes no lock when there is nothing to forget", async () => {
    const s = setup([]);
    const result = await s.use.execute(true);
    expect(result.status).toBe("forgotten");
    expect(s.events).not.toContain("lock");
  });

  it("forgets declarations alone when no file is kept", async () => {
    const s = setup([]);
    declaredAt(s);
    await s.use.execute(true);
    expect(s.cleared).toEqual([CLONE]);
  });

  it("does not take a clone with no key for something to forget", async () => {
    const s = setup([]);
    declaredAt(s, 0);
    await s.use.execute(true);
    expect(s.events).not.toContain("lock");
  });

  it("counts a clone once, whichever of its worktrees were remembered", async () => {
    const s = setup([]);
    remember(s, "/w/main", CLONE, { taskKeys: 2 });
    remember(s, "/w/wt", CLONE, { taskKeys: 2 });
    const result = await s.use.execute(false);
    expect(result.plan.repositories).toEqual([{ clone: CLONE, taskKeys: 2, consent: false }]);
  });

  it("names a clone that is gone and consented, once, and does not read its keys", async () => {
    const s = setup([]);
    remember(s, "/w/a", "/gone/.git", { consenting: true });
    remember(s, "/w/b", "/gone/.git");
    s.keys.delete("/gone/.git");
    const result = await s.use.execute(true);
    expect(result.plan.missing).toEqual(["/gone/.git"]);
    expect(result.plan.repositories).toEqual([]);
    expect(s.cleared).toEqual([]);
  });

  it("does not name a gone clone that never consented, remembered as it was", async () => {
    const s = setup([]);
    remember(s, "/w/a", "/gone/.git");
    s.keys.delete("/gone/.git");
    expect((await s.use.execute(false)).plan.missing).toEqual([]);
  });

  it("names a gone clone that consented though no directory of it was ever remembered", async () => {
    const s = setup([]);
    s.history.consented(cloneOf("/gone/.git"));
    expect((await s.use.execute(false)).plan.missing).toEqual(["/gone/.git"]);
  });

  it("finds the clone of a consent no directory was remembered with", async () => {
    const s = setup([]);
    s.history.consented(cloneOf(CLONE));
    s.keys.set(CLONE, 1);
    s.consented.add(CLONE);
    expect((await s.use.execute(false)).plan.repositories).toEqual([
      { clone: CLONE, taskKeys: 1, consent: true },
    ]);
  });

  it("reports a clone once however many of its identities were remembered", async () => {
    const s = setup([]);
    remember(s, "/w/main", CLONE, { taskKeys: 2 });
    s.history.consented(cloneOf(CLONE, { ino: "99" }));
    expect((await s.use.execute(false)).plan.repositories).toEqual([
      { clone: CLONE, taskKeys: 2, consent: false },
    ]);
  });

  it("counts the repositories that declared a task and were never located", async () => {
    const s = setup([]);
    s.snapshots.appended.push(snapshot(ID), snapshot("other-id"));
    expect((await s.use.execute(false)).plan.unlocated).toBe(2);
  });

  it("does not count a repository whose directory was remembered", async () => {
    const s = setup([]);
    declaredAt(s);
    s.snapshots.appended.push(snapshot("other-id"));
    expect((await s.use.execute(false)).plan.unlocated).toBe(1);
  });

  it("leaves alone the keys of a clone nothing was remembered of", async () => {
    const s = setup([]);
    s.keys.set(CLONE, 4);
    expect((await s.use.execute(false)).plan.repositories).toEqual([]);
  });

  it("locks and erases when files are kept and no clone holds anything", async () => {
    const s = setup();
    await s.use.execute(true);
    expect(s.events).toContain("lock");
    expect(s.events).toContain("erase");
  });

  it("lists clones and gone clones in order", async () => {
    const s = setup([]);
    remember(s, "/w/b", "/w/b/.git", { taskKeys: 1 });
    remember(s, "/w/a", "/w/a/.git", { taskKeys: 1 });
    remember(s, "/g/b", "/g/b/.git", { consenting: true });
    remember(s, "/g/a", "/g/a/.git", { consenting: true });
    s.keys.delete("/g/b/.git");
    s.keys.delete("/g/a/.git");
    const plan = (await s.use.execute(false)).plan;
    expect(plan.repositories.map((r) => r.clone)).toEqual(["/w/a/.git", "/w/b/.git"]);
    expect(plan.missing).toEqual(["/g/a/.git", "/g/b/.git"]);
  });
});
