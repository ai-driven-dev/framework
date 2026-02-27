import { describe, expect, it } from "vitest";
import { StatusReport } from "../../../src/domain/models/status-report.js";

describe("StatusReport", () => {
  it("stores modified, deleted, and untracked lists", () => {
    const report = new StatusReport({
      modified: ["a.md"],
      deleted: ["b.md"],
      untracked: ["c.md"],
    });

    expect(report.modified).toEqual(["a.md"]);
    expect(report.deleted).toEqual(["b.md"]);
    expect(report.untracked).toEqual(["c.md"]);
  });

  it("isEmpty() returns true when all lists are empty", () => {
    const report = new StatusReport({
      modified: [],
      deleted: [],
      untracked: [],
    });
    expect(report.isEmpty()).toBe(true);
  });

  it("isEmpty() returns false when any list has entries", () => {
    expect(new StatusReport({ modified: ["x"], deleted: [], untracked: [] }).isEmpty()).toBe(false);
    expect(new StatusReport({ modified: [], deleted: ["x"], untracked: [] }).isEmpty()).toBe(false);
    expect(new StatusReport({ modified: [], deleted: [], untracked: ["x"] }).isEmpty()).toBe(false);
  });

  it("stores multiple files per list", () => {
    const report = new StatusReport({
      modified: ["a.md", "b.md"],
      deleted: ["c.md"],
      untracked: ["d.md", "e.md", "f.md"],
    });
    expect(report.modified).toHaveLength(2);
    expect(report.deleted).toHaveLength(1);
    expect(report.untracked).toHaveLength(3);
  });
});
