import { describe, expect, it } from "vitest";
import { branchHeadOf } from "../../../../../src/contexts/telemetry/domain/declaration/branch-role.js";

const branchRoleOf = (head: string | null, originHead: string | null) =>
  branchHeadOf(head, originHead).role;

describe("the ref a branch is read from", () => {
  it.each([
    ["refs/heads/feat/x\n", "feat/x"],
    ["refs/heads/", null],
    ["refs/tags/v1", null],
    ["", null],
    [null, null],
  ])("reads %j as %j", (ref, branch) => {
    expect(branchHeadOf(ref, null).branch).toBe(branch);
  });

  it("is detached when it names no branch, and names none", () => {
    expect(branchHeadOf(null, null)).toStrictEqual({ role: "detached", branch: null });
  });

  it("trims a remote head the same way", () => {
    expect(branchRoleOf("refs/heads/dev", "refs/remotes/origin/dev\n")).toBe("default");
    expect(branchRoleOf("refs/heads/main", "refs/remotes/origin/")).toBe("default");
  });

  it("takes only origin's head as the default, another remote's names none", () => {
    expect(branchRoleOf("refs/heads/main", "refs/remotes/upstream/dev")).toBe("default");
    expect(branchRoleOf("refs/heads/dev", "refs/remotes/upstream/dev")).toBe("working");
  });
});
