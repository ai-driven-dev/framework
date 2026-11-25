import { describe, expect, it } from "vitest";
import { requireAgentHosts } from "../../../../src/presentation/controllers/setup/setup-agent-flags.controller.js";

describe("requiring a host that runs the agents", () => {
  it.each(["--provider", "--agents-only"])(
    "asks for an --ide tool that runs the agents when %s came with none",
    (flag) => {
      expect(() => requireAgentHosts(flag, { hosts: [], runnable: ["claude", "codex"] })).toThrow(
        `${flag} needs --ide with a tool that runs the framework's agents: claude, codex.`
      );
    }
  );

  it("lets a tool that runs the agents through", () => {
    expect(() =>
      requireAgentHosts("--provider", { hosts: ["claude"], runnable: ["claude"] })
    ).not.toThrow();
  });
});
