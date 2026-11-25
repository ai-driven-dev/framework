import { describe, expect, it } from "vitest";
import { reachableActivator } from "../../../../src/contexts/host-registration/application/reachable-activator.js";
import { FakeHostActions } from "../../../shared/testing/fake-host-actions.fake.js";

describe("finding an activator on the PATH", () => {
  it("answers the activator of a binary on the PATH", () => {
    const activator = new FakeHostActions({ available: true });

    expect(reachableActivator(new Map([["claude", activator]]), "claude")).toBe(activator);
  });

  it("answers nothing for a binary that is not on the PATH", () => {
    const activators = new Map([["claude", new FakeHostActions({ available: false })]]);

    expect(reachableActivator(activators, "claude")).toBeUndefined();
  });

  it("answers nothing for a binary no activator is wired for, or none is named", () => {
    const activators = new Map([["claude", new FakeHostActions({ available: true })]]);

    expect(reachableActivator(activators, "codex")).toBeUndefined();
    expect(reachableActivator(activators, undefined)).toBeUndefined();
  });
});
