import { describe, expect, it } from "vitest";
import { hostPortsOver } from "../../../../src/contexts/host-registration/application/host-ports-over.js";
import { FakeHostActions } from "../../../shared/testing/fake-host-actions.fake.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";

const empty = { pluginRegistries: new Map(), marketplaceRegistries: new Map(), sources: new Map() };

describe("the host ports answered from the wired maps", () => {
  it("answers the activator wired for a binary, and nothing for another", () => {
    const activator = new FakeHostActions({ available: true });
    const ports = hostPortsOver({ ...empty, activators: new Map([["claude", activator]]) });

    expect(ports.activator("claude")).toBe(activator);
    expect(ports.activator("codex")).toBeUndefined();
  });

  it("answers an activator as reachable only when it is on the PATH", () => {
    const offline = new FakeHostActions({ available: false });
    const ports = hostPortsOver({ ...empty, activators: new Map([["claude", offline]]) });

    expect(ports.reachableActivator("claude")).toBeUndefined();
  });

  it("answers nothing for a tool with no registry wired", () => {
    const ports = hostPortsOver({ ...empty, activators: new Map() });

    expect(ports.pluginRegistry(TOOL.claude)).toBeUndefined();
  });
});
