import { describe, expect, it } from "vitest";
import { ForgetTelemetryUseCase } from "../../../../../src/contexts/telemetry/application/forget/forget-telemetry-use-case.js";
import type { BranchSnapshot } from "../../../../../src/contexts/telemetry/domain/branch-binding.js";
import type { ErasureEntry } from "../../../../../src/contexts/telemetry/domain/ports/forget/measurement-erasure.js";
import type { LocatedDirectory } from "../../../../../src/contexts/telemetry/domain/ports/repository-locator.js";
import { repositoryIdOf } from "../../../../../src/contexts/telemetry/domain/repository-identity.js";
import {
  FakeLocator,
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
  const locator = new FakeLocator();
  const snapshots = new InMemorySnapshots(events);
  const resolutions = new InMemoryResolutions();
  const ledger = new InMemoryLedger(events);
  const cleared: string[] = [];
  const keys = new Map<string, number>();
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
      async count(root) {
        return keys.get(root) ?? 0;
      },
      async clear(root) {
        events.push(`clear ${root}`);
        cleared.push(root);
        return keys.get(root) ?? 0;
      },
    },
    snapshots,
    resolutions,
    locator,
    ledger
  );
  return { use, events, locator, snapshots, resolutions, ledger, cleared, keys };
}

function declaredAt(s: ReturnType<typeof setup>, cwd: string, root = cwd, keys = 3): void {
  s.snapshots.appended.push(snapshot(ID));
  s.resolutions.resolutions.set(cwd, { repository_id: ID, root, consented: true });
  s.locator.directories.set(root, located(root));
  s.keys.set(root, keys);
}

describe("forget without confirmation", () => {
  it("previews what would go and takes no lock and removes nothing", async () => {
    const s = setup();
    declaredAt(s, "/w/repo");
    const result = await s.use.execute(false);
    expect(result).toEqual({
      status: "preview",
      plan: {
        entries: [ENTRY],
        repositories: [{ root: "/w/repo", keys: 3 }],
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
    declaredAt(s, "/w/repo");
    const result = await s.use.execute(true);
    const locked = s.events.slice(s.events.indexOf("lock"));
    expect(locked).toEqual(["lock", "inventory", "clear /w/repo", "erase", "unlock"]);
    expect(result.status).toBe("forgotten");
    expect(result.plan.repositories).toEqual([{ root: "/w/repo", keys: 3 }]);
  });

  it("takes no lock when there is nothing to forget", async () => {
    const s = setup([]);
    const result = await s.use.execute(true);
    expect(result.status).toBe("forgotten");
    expect(s.events).not.toContain("lock");
  });

  it("forgets declarations alone when no file is kept", async () => {
    const s = setup([]);
    declaredAt(s, "/w/repo");
    await s.use.execute(true);
    expect(s.cleared).toEqual(["/w/repo"]);
  });

  it("does not take a repository with no declaration key for something to forget", async () => {
    const s = setup([]);
    declaredAt(s, "/w/repo", "/w/repo", 0);
    await s.use.execute(true);
    expect(s.events).not.toContain("lock");
  });

  it("counts a repository once, whichever of its worktrees were remembered", async () => {
    const s = setup([]);
    s.snapshots.appended.push(snapshot(ID));
    for (const root of ["/w/main", "/w/wt"]) {
      s.resolutions.resolutions.set(root, { repository_id: ID, root, consented: true });
      s.locator.directories.set(
        root,
        located(root, "https://github.com/acme/widgets.git", "/w/main")
      );
    }
    s.keys.set("/w/main", 2);
    const result = await s.use.execute(false);
    expect(result.plan.repositories).toEqual([{ root: "/w/main", keys: 2 }]);
  });

  it("skips and names a root that is gone, or is now another repository", async () => {
    const s = setup([]);
    s.snapshots.appended.push(snapshot(ID));
    s.resolutions.resolutions.set("/gone", { repository_id: ID, root: "/gone", consented: true });
    s.resolutions.resolutions.set("/moved", { repository_id: ID, root: "/moved", consented: true });
    s.locator.directories.set("/moved", located("/moved", "https://github.com/acme/other.git"));
    const result = await s.use.execute(false);
    expect(result.plan.missing).toEqual(["/gone", "/moved"]);
    expect(result.plan.repositories).toEqual([]);
  });

  it("does not report a stale root of a repository that is found elsewhere", async () => {
    const s = setup([]);
    declaredAt(s, "/w/repo");
    s.resolutions.resolutions.set("/gone", { repository_id: ID, root: "/gone", consented: true });
    expect((await s.use.execute(false)).plan.missing).toEqual([]);
  });

  it("counts the repositories that declared a task and were never located", async () => {
    const s = setup([]);
    s.snapshots.appended.push(snapshot(ID), snapshot("other-id"));
    expect((await s.use.execute(false)).plan.unlocated).toBe(2);
  });

  it("leaves alone a repository nobody declared a task in", async () => {
    const s = setup([]);
    s.resolutions.resolutions.set("/w/repo", {
      repository_id: ID,
      root: "/w/repo",
      consented: true,
    });
    s.locator.directories.set("/w/repo", located("/w/repo"));
    s.keys.set("/w/repo", 4);
    expect((await s.use.execute(false)).plan.repositories).toEqual([]);
  });

  it("locks and erases when files are kept and no repository declared anything", async () => {
    const s = setup();
    await s.use.execute(true);
    expect(s.events).toContain("lock");
    expect(s.events).toContain("erase");
  });

  it("lists repositories and skipped roots in order", async () => {
    const s = setup([]);
    s.snapshots.appended.push(snapshot(ID), snapshot("other-id"));
    for (const root of ["/w/b", "/w/a"]) {
      s.resolutions.resolutions.set(root, { repository_id: ID, root, consented: true });
      s.locator.directories.set(root, located(root));
      s.keys.set(root, 1);
    }
    for (const root of ["/g/b", "/g/a"]) {
      s.resolutions.resolutions.set(root, { repository_id: "other-id", root, consented: true });
    }
    const plan = (await s.use.execute(false)).plan;
    expect(plan.repositories.map((r) => r.root)).toEqual(["/w/a", "/w/b"]);
    expect(plan.missing).toEqual(["/g/a", "/g/b"]);
  });
});
