import { describe, expect, it } from "vitest";
import {
  type BranchSnapshot,
  needsReflog,
  nextSnapshot,
  oldestReflogTime,
  parseBranchConfig,
  parseBranchSnapshot,
  snapshotKey,
} from "../../../../src/contexts/telemetry/domain/branch-binding.js";

const entry = (key: string, value: string): string => `${key}\n${value}`;
const listing = (...entries: string[]): string => entries.map((e) => `${e}\0`).join("");

describe("git config output is read into bindings", () => {
  it("reads the three keys of a branch, which git lists in lower case", () => {
    const out = listing(
      entry("branch.feat/x.aiddtask", "checkout-fix"),
      entry("branch.feat/x.aiddticket", "PROJ-12"),
      entry("branch.feat/x.aidddeclaredat", "2026-10-07T10:00:00.000Z")
    );
    expect(parseBranchConfig(out)).toEqual([
      {
        branch: "feat/x",
        task: "checkout-fix",
        ticket: "PROJ-12",
        declared_at: "2026-10-07T10:00:00.000Z",
        none: false,
      },
    ]);
  });

  it("reads the keys whatever case they are spelt in", () => {
    const out = listing(entry("branch.x.aiddTask", "t"), entry("branch.x.AIDDDeclaredAt", "d"));
    expect(parseBranchConfig(out)).toMatchObject([{ branch: "x", task: "t", declared_at: "d" }]);
  });

  it("keeps a branch name with dots and mixed case whole", () => {
    const out = listing(entry("branch.Release/1.2.aiddtask", "t"));
    expect(parseBranchConfig(out).map((b) => b.branch)).toEqual(["Release/1.2"]);
  });

  it("lists branches apart, in name order", () => {
    const out = listing(
      entry("branch.b.aiddtask", "tb"),
      entry("branch.c.aiddtask", "tc"),
      entry("branch.a.aiddtask", "ta")
    );
    expect(parseBranchConfig(out).map((b) => [b.branch, b.task])).toEqual([
      ["a", "ta"],
      ["b", "tb"],
      ["c", "tc"],
    ]);
  });

  it("reads a declaration of no task as none", () => {
    const out = listing(entry("branch.x.aidddeclaredat", "2026-10-07T10:00:00.000Z"));
    expect(parseBranchConfig(out)).toEqual([
      {
        branch: "x",
        task: null,
        ticket: null,
        declared_at: "2026-10-07T10:00:00.000Z",
        none: true,
      },
    ]);
  });

  it("reads an empty task as none too", () => {
    const out = listing(
      entry("branch.x.aiddtask", ""),
      entry("branch.x.aidddeclaredat", "2026-10-07T10:00:00.000Z")
    );
    expect(parseBranchConfig(out)[0]).toMatchObject({ task: null, none: true });
  });

  it("does not call a branch none while it has no declaration time", () => {
    const out = listing(entry("branch.x.aiddticket", "T-1"));
    expect(parseBranchConfig(out)[0]).toMatchObject({ task: null, declared_at: null, none: false });
  });

  it("keeps a value holding a newline whole", () => {
    const out = listing(entry("branch.x.aiddtask", "line one\nline two"));
    expect(parseBranchConfig(out)[0]?.task).toBe("line one\nline two");
  });

  it("reads a key given with no value as an empty one", () => {
    expect(parseBranchConfig("branch.x.aiddtask\0")[0]).toMatchObject({ task: null });
  });

  it("ignores keys that are not the three, and no output at all", () => {
    expect(parseBranchConfig(listing(entry("branch.x.remote", "origin")))).toEqual([]);
    expect(parseBranchConfig(listing(entry("core.aiddtask", "x")))).toEqual([]);
    expect(parseBranchConfig("")).toEqual([]);
  });
});

describe("the oldest reflog entry is the branch's creation", () => {
  it("takes the last line, which git lists newest first, as UTC", () => {
    const out = [
      "refs/heads/x@{2026-10-09T12:00:00+02:00}",
      "refs/heads/x@{2026-10-07T12:00:00+02:00}",
    ].join("\n");
    expect(oldestReflogTime(`${out}\n`)).toBe("2026-10-07T10:00:00.000Z");
  });

  it("takes the last of three lines, not the second", () => {
    const out = [
      "x@{2026-10-09T12:00:00+02:00}",
      "x@{2026-10-08T12:00:00+02:00}",
      "x@{2026-10-07T12:00:00+02:00}",
    ].join("\n");
    expect(oldestReflogTime(out)).toBe("2026-10-07T10:00:00.000Z");
  });

  it("reads the selector git prints, which names the branch without refs/heads", () => {
    expect(oldestReflogTime("feat/x@{2026-10-07T12:00:00+02:00}\n")).toBe(
      "2026-10-07T10:00:00.000Z"
    );
  });

  it("is none for a selector without its closing brace", () => {
    expect(oldestReflogTime("x@{2026-10-07T12:00:00+02:00\n")).toBeNull();
  });

  it("is none for a time in braces with no selector before it", () => {
    expect(oldestReflogTime("{2026-10-07T12:00:00+02:00}\n")).toBeNull();
  });

  it("is none for an empty reflog or a line it cannot read", () => {
    expect(oldestReflogTime("")).toBeNull();
    expect(oldestReflogTime("\n")).toBeNull();
    expect(oldestReflogTime("refs/heads/x@{garbage}\n")).toBeNull();
    expect(oldestReflogTime("no selector\n")).toBeNull();
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
