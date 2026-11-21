import { describe, expect, it } from "vitest";
import { RecordAgentProviders } from "../../../../../src/contexts/installation/application/agents/record-agent-providers.use-case.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { InMemoryAgentModelStore } from "../../testing/in-memory-agent-model-store.fake.js";

function recorder(providers: Record<string, string> = {}) {
  const store = new InMemoryAgentModelStore(providers);
  return { store, record: new RecordAgentProviders(store, registeredTools()) };
}

describe("RecordAgentProviders", () => {
  it("records the provider of each host and hands back what was recorded before", async () => {
    const { store, record } = recorder({ opencode: "openai", cursor: "anthropic" });

    const { chosen, before } = await record.execute({
      hosts: [TOOL.opencode],
      provider: "mistral",
    });

    expect(store.providers).toStrictEqual({ opencode: "mistral", cursor: "anthropic" });
    expect(before).toStrictEqual({ opencode: "openai", cursor: "anthropic" });
    expect([...chosen]).toStrictEqual([["opencode", "mistral"]]);
  });

  it("forgets the provider of every host named when none is chosen", async () => {
    const { store, record } = recorder({ opencode: "openai", cursor: "anthropic" });

    const { chosen } = await record.execute({ hosts: [TOOL.opencode] });

    expect(store.providers).toStrictEqual({ cursor: "anthropic" });
    expect(chosen.size).toBe(0);
  });

  it("refuses a provider one host cannot run before writing anything", async () => {
    const { store, record } = recorder({ cursor: "anthropic" });

    await expect(
      record.execute({ hosts: [TOOL.opencode, TOOL.claude], provider: "mistral" })
    ).rejects.toThrow('Provider "mistral" is not supported for "claude". Use: anthropic.');
    expect(store.providers).toStrictEqual({ cursor: "anthropic" });
  });

  it("refuses a provider for a host that runs no agent provider at all", async () => {
    const { record } = recorder();

    await expect(
      record.execute({ hosts: [TOOL.antigravity], provider: "anthropic" })
    ).rejects.toThrow('No agent provider is supported for "antigravity".');
  });
});
