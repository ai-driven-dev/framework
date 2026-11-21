import { describe, expect, it } from "vitest";
import { branchCreatedAt } from "../../../../src/contexts/telemetry/domain/branch-creation.js";

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
