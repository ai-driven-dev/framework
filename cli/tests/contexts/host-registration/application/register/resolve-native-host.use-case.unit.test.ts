import { describe, expect, it } from "vitest";
import { ResolveNativeHost } from "../../../../../src/contexts/host-registration/application/register/resolve-native-host.use-case.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

describe("resolving the native CLI that drives a tool", () => {
  it("answers the profile, the binary it declares and the activator serving it", () => {
    const activator = new FakeHostActions({ available: true });

    const host = new ResolveNativeHost(new Map([["claude", activator]]), registeredTools()).execute(
      TOOL.claude
    );

    expect(host?.binary).toBe("claude");
    expect(host?.activator).toBe(activator);
  });

  it("answers nothing when no activator serves the binary", () => {
    expect(
      new ResolveNativeHost(new Map(), registeredTools()).execute(TOOL.claude)
    ).toBeUndefined();
  });
});
