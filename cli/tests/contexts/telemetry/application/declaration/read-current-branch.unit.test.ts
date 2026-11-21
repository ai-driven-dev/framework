import { describe, expect, it } from "vitest";
import { ReadCurrentBranch } from "../../../../../src/contexts/telemetry/application/declaration/read-current-branch.js";
import { FakeBindings } from "../../testing/fake-bindings.fake.js";
import { FakeBranchStore } from "../../testing/fake-branch-store.fake.js";

const ROOT = "/work/repo";
const DECLARED = {
  branch: "feat/x",
  task: "checkout-fix",
  ticket: "PROJ-12",
  declared_at: "2026-10-09T10:00:00.000Z",
  none: false,
};

function setup(head: string | null, originHead: string | null = null) {
  const store = new FakeBranchStore();
  store.heads_ = { head, originHead };
  const source = new FakeBindings();
  source.bindingsByRoot.set(ROOT, [DECLARED, { ...DECLARED, branch: "main" }]);
  return { source, useCase: new ReadCurrentBranch(store, source) };
}

describe("the branch being worked on", () => {
  it("names what a working branch declares", async () => {
    const { useCase } = setup("refs/heads/feat/x");
    expect(await useCase.execute(ROOT)).toEqual({
      name: "feat/x",
      role: "working",
      declared: DECLARED,
    });
  });

  it("reads no declaration of the default branch, though one is written on it", async () => {
    const { useCase, source } = setup("refs/heads/main");
    expect(await useCase.execute(ROOT)).toEqual({ name: "main", role: "default", declared: null });
    expect(source.events).toEqual([]);
  });

  it("names no branch of a detached head", async () => {
    const { useCase } = setup(null);
    expect(await useCase.execute(ROOT)).toEqual({ name: null, role: "detached", declared: null });
  });

  it("holds no declaration for a working branch that declares nothing", async () => {
    const { useCase } = setup("refs/heads/feat/other");
    expect((await useCase.execute(ROOT)).declared).toBeNull();
  });
});
