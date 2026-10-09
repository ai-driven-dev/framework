import { describe, expect, it } from "vitest";
import {
  branchRoleOf,
  currentBranchOf,
} from "../../../../src/contexts/telemetry/domain/declaration/branch-role.js";

describe("the branch HEAD is on", () => {
  it("is the name after refs/heads/, slashes kept", () => {
    expect(currentBranchOf("refs/heads/feat/x\n")).toBe("feat/x");
  });

  it("is nothing when detached or when git answered with something else", () => {
    expect(currentBranchOf(null)).toBeNull();
    expect(currentBranchOf("")).toBeNull();
    expect(currentBranchOf("refs/heads/")).toBeNull();
    expect(currentBranchOf("refs/tags/v1")).toBeNull();
  });
});

describe("what a branch is in its repository", () => {
  it("is default where the remote's head points", () => {
    expect(branchRoleOf("refs/heads/develop", "refs/remotes/origin/develop")).toBe("default");
  });

  it("is working anywhere else, main included, once the remote names another default", () => {
    expect(branchRoleOf("refs/heads/main", "refs/remotes/origin/develop")).toBe("working");
    expect(branchRoleOf("refs/heads/feat/x", "refs/remotes/origin/main")).toBe("working");
  });

  it("falls back to main and master when the remote has no head", () => {
    expect(branchRoleOf("refs/heads/main", null)).toBe("default");
    expect(branchRoleOf("refs/heads/master", null)).toBe("default");
    expect(branchRoleOf("refs/heads/develop", null)).toBe("working");
  });

  it("is detached without a branch, whatever the remote says", () => {
    expect(branchRoleOf(null, "refs/remotes/origin/main")).toBe("detached");
    expect(branchRoleOf(null, null)).toBe("detached");
  });

  it("reads a remote default with slashes whole, and ignores a remote head that is not origin's", () => {
    expect(branchRoleOf("refs/heads/release/stable", "refs/remotes/origin/release/stable")).toBe(
      "default"
    );
    expect(branchRoleOf("refs/heads/main", "refs/remotes/upstream/dev")).toBe("default");
  });
});
