import { describe, expect, it } from "vitest";
import {
  type BranchSnapshot,
  needsReflog,
  nextSnapshot,
  parseBranchConfig,
  snapshotKey,
} from "../../../../src/contexts/telemetry/domain/branch-binding.js";

const entry = (key: string, value: string): string => `${key}\n${value}`;
const listing = (...entries: string[]): string => entries.map((e) => `${e}\0`).join("");

const D = "2026-10-07T10:00:00.000Z";
const declaredAt = (branch: string): string => entry(`branch.${branch}.aidddeclaredat`, D);

describe("git config output is read into bindings", () => {
  it("reads the keys of a branch, which git lists in lower case", () => {
    const out = listing(
      entry("branch.feat/x.aiddtask", "checkout-fix"),
      entry("branch.feat/x.aiddticket", "PROJ-12"),
      entry("branch.feat/x.aidddeclaredfor", "feat/x"),
      entry("branch.feat/x.aidddeclaredat", D)
    );
    expect(parseBranchConfig(out)).toEqual([
      {
        branch: "feat/x",
        task: "checkout-fix",
        ticket: "PROJ-12",
        declared_at: D,
        none: false,
      },
    ]);
  });

  it("reads the keys whatever case they are spelt in", () => {
    const out = listing(
      entry("branch.x.aiddTask", "t"),
      entry("branch.x.AIDDDeclaredFor", "x"),
      entry("branch.x.AIDDDeclaredAt", "d")
    );
    expect(parseBranchConfig(out)).toMatchObject([{ branch: "x", task: "t", declared_at: "d" }]);
  });

  it("keeps a branch name with dots and mixed case whole", () => {
    const out = listing(entry("branch.Release/1.2.aiddtask", "t"), declaredAt("Release/1.2"));
    expect(parseBranchConfig(out).map((b) => b.branch)).toEqual(["Release/1.2"]);
  });

  it("lists branches apart, in name order", () => {
    const out = listing(
      entry("branch.b.aiddtask", "tb"),
      declaredAt("b"),
      entry("branch.c.aiddtask", "tc"),
      declaredAt("c"),
      entry("branch.a.aiddtask", "ta"),
      declaredAt("a")
    );
    expect(parseBranchConfig(out).map((b) => [b.branch, b.task])).toEqual([
      ["a", "ta"],
      ["b", "tb"],
      ["c", "tc"],
    ]);
  });

  it("reads a declaration of no task as none", () => {
    const out = listing(declaredAt("x"));
    expect(parseBranchConfig(out)).toEqual([
      { branch: "x", task: null, ticket: null, declared_at: D, none: true },
    ]);
  });

  it("reads an empty task as none too", () => {
    const out = listing(entry("branch.x.aiddtask", ""), declaredAt("x"));
    expect(parseBranchConfig(out)[0]).toMatchObject({ task: null, none: true });
  });

  it("keeps a value holding a newline whole", () => {
    const out = listing(entry("branch.x.aiddtask", "line one\nline two"), declaredAt("x"));
    expect(parseBranchConfig(out)[0]?.task).toBe("line one\nline two");
  });

  it("reads a key given with no value as an empty one", () => {
    expect(parseBranchConfig(`branch.x.aiddtask\0${listing(declaredAt("x"))}`)[0]).toMatchObject({
      task: null,
      none: true,
    });
  });

  it("ignores keys that are not the four, and no output at all", () => {
    expect(parseBranchConfig(listing(entry("branch.x.remote", "origin")))).toEqual([]);
    expect(parseBranchConfig("")).toEqual([]);
  });
});

describe("only a declaration the command made on the branch counts", () => {
  it("reads nothing from a task or a ticket with no declaration time", () => {
    const out = listing(
      entry("branch.x.aiddtask", "by-hand"),
      entry("branch.y.aiddticket", "T-1"),
      entry("branch.z.aidddeclaredfor", "z")
    );
    expect(parseBranchConfig(out)).toEqual([]);
  });

  it("reads nothing from a declaration made for another branch, as a copy or a rename leaves it", () => {
    const out = listing(
      entry("branch.copy.aiddtask", "theirs"),
      entry("branch.copy.aidddeclaredfor", "original"),
      declaredAt("copy")
    );
    expect(parseBranchConfig(out)).toEqual([]);
  });

  it("tells a stamp apart from a branch whose name differs only in case", () => {
    const out = listing(
      entry("branch.Feat.aiddtask", "t"),
      entry("branch.Feat.aidddeclaredfor", "feat"),
      declaredAt("Feat")
    );
    expect(parseBranchConfig(out)).toEqual([]);
  });

  it("reads nothing from a branch copied onto with -C, which lists a key twice", () => {
    const out = listing(
      entry("branch.y.aiddtask", "theirs"),
      entry("branch.y.aidddeclaredfor", "x"),
      declaredAt("y"),
      entry("branch.y.aidddeclaredfor", "y"),
      declaredAt("y")
    );
    expect(parseBranchConfig(out)).toEqual([]);
  });

  it("reads nothing from a branch whose task alone is listed twice", () => {
    const out = listing(
      entry("branch.y.aiddtask", "theirs"),
      entry("branch.y.aiddtask", "ours"),
      entry("branch.y.aidddeclaredfor", "y"),
      declaredAt("y")
    );
    expect(parseBranchConfig(out)).toEqual([]);
  });

  it("reads nothing from a branch whose task is listed twice, once with no value", () => {
    const out = listing(
      "branch.y.aiddtask",
      entry("branch.y.aiddtask", "ours"),
      entry("branch.y.aidddeclaredfor", "y"),
      declaredAt("y")
    );
    expect(parseBranchConfig(out)).toEqual([]);
  });

  it("still reads a declaration written before declarations were stamped", () => {
    const out = listing(entry("branch.x.aiddtask", "legacy"), declaredAt("x"));
    expect(parseBranchConfig(out)).toMatchObject([{ branch: "x", task: "legacy" }]);
  });

  it("keeps the declared branches when another one is not declared", () => {
    const out = listing(
      entry("branch.a.aiddtask", "kept"),
      entry("branch.a.aidddeclaredfor", "a"),
      declaredAt("a"),
      entry("branch.b.aiddtask", "dropped")
    );
    expect(parseBranchConfig(out).map((b) => b.task)).toEqual(["kept"]);
  });
});

describe("a snapshot is taken only when the binding differs from the latest one", () => {
  const now = "2026-10-09T09:00:00.000Z";
  const observed = {
    branch: "x",
    task: "t",
    ticket: null,
    declared_at: "2026-10-07T10:00:00.000Z",
    none: false,
  };
  const latest: BranchSnapshot = {
    repository_id: "r",
    ...observed,
    branch_created_at: "2026-10-06T00:00:00.000Z",
    snapshot_at: "2026-10-07T10:00:01.000Z",
  };

  it("takes the first one", () => {
    const next = nextSnapshot({
      repositoryId: "r",
      latest: undefined,
      observed,
      reflogCreatedAt: "2026-10-06T00:00:00.000Z",
      now,
    });
    expect(next).toEqual({
      repository_id: "r",
      ...observed,
      branch_created_at: "2026-10-06T00:00:00.000Z",
      snapshot_at: now,
    });
  });

  it("takes one when only the task became none", () => {
    const next = nextSnapshot({
      repositoryId: "r",
      latest,
      observed: { ...observed, none: true },
      reflogCreatedAt: null,
      now,
    });
    expect(next).toMatchObject({ none: true, task: "t" });
  });

  it("takes none when nothing changed", () => {
    expect(
      nextSnapshot({
        repositoryId: "r",
        latest,
        observed,
        reflogCreatedAt: "2026-10-06T00:00:00.000Z",
        now,
      })
    ).toBeNull();
  });

  it.each([
    ["task", { task: "other" }],
    ["ticket", { ticket: "T-9" }],
    ["none", { none: true, task: null }],
    ["declaration time", { declared_at: "2026-10-08T10:00:00.000Z" }],
  ])("takes one when the %s changed", (_name, change) => {
    const next = nextSnapshot({
      repositoryId: "r",
      latest,
      observed: { ...observed, ...change },
      reflogCreatedAt: "2026-10-06T00:00:00.000Z",
      now,
    });
    expect(next).toMatchObject({ ...change, snapshot_at: now });
  });

  it("takes one when the creation time changed under a new declaration", () => {
    const next = nextSnapshot({
      repositoryId: "r",
      latest,
      observed: { ...observed, declared_at: "2026-10-08T10:00:00.000Z" },
      reflogCreatedAt: "2026-10-08T09:00:00.000Z",
      now,
    });
    expect(next?.branch_created_at).toBe("2026-10-08T09:00:00.000Z");
  });

  it("keeps the earlier creation time when the reflog now says a later one for the same declaration", () => {
    expect(
      nextSnapshot({
        repositoryId: "r",
        latest,
        observed,
        reflogCreatedAt: "2026-10-08T00:00:00.000Z",
        now,
      })
    ).toBeNull();
  });

  it("fills a creation time that was unknown", () => {
    const unknown = { ...latest, branch_created_at: null };
    const next = nextSnapshot({
      repositoryId: "r",
      latest: unknown,
      observed,
      reflogCreatedAt: "2026-10-06T00:00:00.000Z",
      now,
    });
    expect(next?.branch_created_at).toBe("2026-10-06T00:00:00.000Z");
  });

  it("keeps a creation time unknown while the reflog cannot say", () => {
    const unknown = { ...latest, branch_created_at: null };
    expect(
      nextSnapshot({ repositoryId: "r", latest: unknown, observed, reflogCreatedAt: null, now })
    ).toBeNull();
  });

  it("keys a snapshot by repository and branch", () => {
    expect(snapshotKey("r", "x")).not.toBe(snapshotKey("r2", "x"));
    expect(snapshotKey("r", "x")).not.toBe(snapshotKey("r", "y"));
    expect(snapshotKey("a", "bc")).not.toBe(snapshotKey("ab", "c"));
  });
});

describe("the reflog is read only when it can add something", () => {
  const observed = { branch: "x", task: "t", ticket: null, declared_at: "d1", none: false };
  const latest: BranchSnapshot = {
    repository_id: "r",
    ...observed,
    branch_created_at: "2026-10-06T00:00:00.000Z",
    snapshot_at: "s",
  };

  it("is needed for a branch never snapshotted", () => {
    expect(needsReflog(undefined, observed)).toBe(true);
  });

  it("is needed under a new declaration", () => {
    expect(needsReflog(latest, { ...observed, declared_at: "d2" })).toBe(true);
  });

  it("is needed while the creation time is unknown", () => {
    expect(needsReflog({ ...latest, branch_created_at: null }, observed)).toBe(true);
  });

  it("is not needed once this declaration has its creation time", () => {
    expect(needsReflog(latest, observed)).toBe(false);
  });
});
