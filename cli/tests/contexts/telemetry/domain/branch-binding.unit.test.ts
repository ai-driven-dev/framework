import { describe, expect, it } from "vitest";
import {
  type BranchSnapshot,
  branchCreatedAt,
  needsReflog,
  nextSnapshot,
  parseBranchConfig,
  parseBranchSnapshot,
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
    expect(parseBranchConfig(listing(entry("core.aiddtask", "x")))).toEqual([]);
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

describe("the reflog says when the branch took its name", () => {
  it("takes the last line, which git lists newest first, as UTC", () => {
    const out = [
      "refs/heads/x@{2026-10-09T12:00:00+02:00}",
      "refs/heads/x@{2026-10-07T12:00:00+02:00}",
    ].join("\n");
    expect(branchCreatedAt(`${out}\n`, "x")).toBe("2026-10-07T10:00:00.000Z");
  });

  it("takes the last of three lines, not the second", () => {
    const out = [
      "x@{2026-10-09T12:00:00+02:00}",
      "x@{2026-10-08T12:00:00+02:00}",
      "x@{2026-10-07T12:00:00+02:00}",
    ].join("\n");
    expect(branchCreatedAt(out, "x")).toBe("2026-10-07T10:00:00.000Z");
  });

  it("reads the selector git prints, which names the branch without refs/heads", () => {
    expect(branchCreatedAt("feat/x@{2026-10-07T12:00:00+02:00}\n", "x")).toBe(
      "2026-10-07T10:00:00.000Z"
    );
  });

  it("takes the newest entry where the branch took its name by a copy or a rename", () => {
    const out = [
      "y@{2026-10-09T12:00:00+02:00}\tcommit: later",
      "y@{2026-10-08T12:00:00+02:00}\tBranch: renamed refs/heads/x to refs/heads/y",
      "y@{2026-10-06T12:00:00+02:00}\tBranch: copied refs/heads/w to refs/heads/x",
      "y@{2026-10-01T12:00:00+02:00}\tbranch: Created from main",
    ].join("\n");
    expect(branchCreatedAt(out, "y")).toBe("2026-10-08T10:00:00.000Z");
    expect(branchCreatedAt(out.replace("renamed", "copied"), "y")).toBe("2026-10-08T10:00:00.000Z");
  });

  it("reads the rename libgit2 writes, in lower case, as git's own", () => {
    const out = [
      "y@{2026-10-08T12:00:00+02:00}\tbranch: renamed refs/heads/x to refs/heads/y",
      "y@{2026-10-01T12:00:00+02:00}\tbranch: Created from main",
    ].join("\n");
    expect(branchCreatedAt(out, "y")).toBe("2026-10-08T10:00:00.000Z");
  });

  it("ignores an entry that moved another name, or that names this one only as a prefix", () => {
    const out = [
      "y@{2026-10-08T12:00:00+02:00}\tBranch: renamed refs/heads/x to refs/heads/yy",
      "y@{2026-10-07T12:00:00+02:00}\tcommit: Branch: renamed refs/heads/x to refs/heads/y",
      "y@{2026-10-01T12:00:00+02:00}\tbranch: Created from main",
    ].join("\n");
    expect(branchCreatedAt(out, "y")).toBe("2026-10-01T10:00:00.000Z");
  });

  it("is none for a selector without its closing brace", () => {
    expect(branchCreatedAt("x@{2026-10-07T12:00:00+02:00\n", "x")).toBeNull();
    // A last character other than the brace, with a valid time before it.
    expect(branchCreatedAt("x@{2026-10-07T12:00:00+02:00)\n", "x")).toBeNull();
  });

  it("is none for a time in braces with no selector before it", () => {
    expect(branchCreatedAt("{2026-10-07T12:00:00+02:00}\n", "x")).toBeNull();
  });

  it("is none for an empty reflog or a line it cannot read", () => {
    expect(branchCreatedAt("", "x")).toBeNull();
    expect(branchCreatedAt("\n", "x")).toBeNull();
    expect(branchCreatedAt("refs/heads/x@{garbage}\n", "x")).toBeNull();
    expect(branchCreatedAt("no selector\n", "x")).toBeNull();
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
    const next = nextSnapshot("r", undefined, observed, "2026-10-06T00:00:00.000Z", now);
    expect(next).toEqual({
      repository_id: "r",
      ...observed,
      branch_created_at: "2026-10-06T00:00:00.000Z",
      snapshot_at: now,
    });
  });

  it("takes one when only the task became none", () => {
    const next = nextSnapshot("r", latest, { ...observed, none: true }, null, now);
    expect(next).toMatchObject({ none: true, task: "t" });
  });

  it("takes none when nothing changed", () => {
    expect(nextSnapshot("r", latest, observed, "2026-10-06T00:00:00.000Z", now)).toBeNull();
  });

  it.each([
    ["task", { task: "other" }],
    ["ticket", { ticket: "T-9" }],
    ["none", { none: true, task: null }],
    ["declaration time", { declared_at: "2026-10-08T10:00:00.000Z" }],
  ])("takes one when the %s changed", (_name, change) => {
    const next = nextSnapshot(
      "r",
      latest,
      { ...observed, ...change },
      "2026-10-06T00:00:00.000Z",
      now
    );
    expect(next).toMatchObject({ ...change, snapshot_at: now });
  });

  it("takes one when the creation time changed under a new declaration", () => {
    const next = nextSnapshot(
      "r",
      latest,
      { ...observed, declared_at: "2026-10-08T10:00:00.000Z" },
      "2026-10-08T09:00:00.000Z",
      now
    );
    expect(next?.branch_created_at).toBe("2026-10-08T09:00:00.000Z");
  });

  it("keeps the earlier creation time when the reflog now says a later one for the same declaration", () => {
    expect(nextSnapshot("r", latest, observed, "2026-10-08T00:00:00.000Z", now)).toBeNull();
  });

  it("fills a creation time that was unknown", () => {
    const unknown = { ...latest, branch_created_at: null };
    const next = nextSnapshot("r", unknown, observed, "2026-10-06T00:00:00.000Z", now);
    expect(next?.branch_created_at).toBe("2026-10-06T00:00:00.000Z");
  });

  it("keeps a creation time unknown while the reflog cannot say", () => {
    const unknown = { ...latest, branch_created_at: null };
    expect(nextSnapshot("r", unknown, observed, null, now)).toBeNull();
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

describe("a snapshot line is read back or refused", () => {
  const snapshot: BranchSnapshot = {
    repository_id: "r",
    branch: "feat/x",
    task: "t",
    ticket: "T-1",
    declared_at: "2026-10-07T10:00:00.000Z",
    none: false,
    branch_created_at: "2026-10-06T00:00:00.000Z",
    snapshot_at: "2026-10-07T10:00:01.000Z",
  };

  it("round-trips", () => {
    expect(parseBranchSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("keeps the nullable fields null", () => {
    const bare = {
      ...snapshot,
      task: null,
      ticket: null,
      declared_at: null,
      branch_created_at: null,
    };
    expect(parseBranchSnapshot(JSON.stringify(bare))).toEqual(bare);
  });

  it.each([
    ["not json", "{nope"],
    ["not an object", "[]"],
    ["an empty line", ""],
    ["no repository", { ...snapshot, repository_id: undefined }],
    ["an empty repository", { ...snapshot, repository_id: "" }],
    ["a numeric repository", { ...snapshot, repository_id: 4 }],
    ["no branch", { ...snapshot, branch: undefined }],
    ["an empty branch", { ...snapshot, branch: "" }],
    ["a numeric branch", { ...snapshot, branch: 4 }],
    ["no snapshot time", { ...snapshot, snapshot_at: undefined }],
    ["a numeric snapshot time", { ...snapshot, snapshot_at: 4 }],
    ["a text none", { ...snapshot, none: "false" }],
    ["no none", { ...snapshot, none: undefined }],
    ["a numeric task", { ...snapshot, task: 4 }],
    ["a numeric ticket", { ...snapshot, ticket: 4 }],
    ["a numeric declaration time", { ...snapshot, declared_at: 4 }],
    ["a numeric creation time", { ...snapshot, branch_created_at: 4 }],
    ["a missing task", { ...snapshot, task: undefined }],
  ])("refuses %s", (_name, value) => {
    const line = typeof value === "string" ? value : JSON.stringify(value);
    expect(parseBranchSnapshot(line)).toBeNull();
  });
});
