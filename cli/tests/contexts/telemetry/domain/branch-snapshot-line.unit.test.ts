import { describe, expect, it } from "vitest";
import type { BranchSnapshot } from "../../../../src/contexts/telemetry/domain/branch-binding.js";
import { parseBranchSnapshot } from "../../../../src/contexts/telemetry/domain/branch-snapshot-line.js";

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
