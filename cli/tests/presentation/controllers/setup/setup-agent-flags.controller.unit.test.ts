import { describe, expect, it } from "vitest";
import {
  requireAgentHosts,
  requireProviderForAgentsOnly,
} from "../../../../src/presentation/controllers/setup/setup-agent-flags.controller.js";

describe("requiring a provider for the agents alone", () => {
  it("asks for a provider, or none, when only the agents are to change", () => {
    expect(() => requireProviderForAgentsOnly(true, undefined)).toThrow(
      "--agents-only needs --provider, a provider or none."
    );
  });

  it("lets through a named provider, none, or a run that is not agents-only", () => {
    expect(() => requireProviderForAgentsOnly(true, "none")).not.toThrow();
    expect(() => requireProviderForAgentsOnly(true, "openai")).not.toThrow();
    expect(() => requireProviderForAgentsOnly(undefined, undefined)).not.toThrow();
  });
});

describe("requiring a host that runs the agents", () => {
  it("asks for an --ide tool that runs the agents when none was given", () => {
    expect(() => requireAgentHosts("openai", { hosts: [], runnable: ["claude", "codex"] })).toThrow(
      "--provider needs --ide with a tool that runs the framework's agents: claude, codex."
    );
  });

  it("lets a run with no provider, or a tool that runs the agents, through", () => {
    expect(() => requireAgentHosts(undefined, { hosts: [], runnable: ["claude"] })).not.toThrow();
    expect(() =>
      requireAgentHosts("openai", { hosts: ["claude"], runnable: ["claude"] })
    ).not.toThrow();
  });
});
