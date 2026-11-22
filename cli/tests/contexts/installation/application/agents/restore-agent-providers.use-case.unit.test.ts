import { describe, expect, it } from "vitest";
import { RestoreAgentProviders } from "../../../../../src/contexts/installation/application/agents/restore-agent-providers.use-case.js";
import { InMemoryAgentModelStore } from "../../testing/in-memory-agent-model-store.fake.js";

describe("restoring the recorded agent providers", () => {
  it("puts the recorded providers back and names the hosts that lose theirs", async () => {
    const store = new InMemoryAgentModelStore({ a: "x", b: "y" });
    const restore = new RestoreAgentProviders(store);

    const forgotten = await restore.execute({ providers: { a: "z" } });

    expect(store.providers).toStrictEqual({ a: "z" });
    expect(forgotten).toStrictEqual(["b"]);
  });

  it("forgets every host's provider when given none", async () => {
    const store = new InMemoryAgentModelStore({ a: "x", b: "y" });

    const forgotten = await new RestoreAgentProviders(store).execute({ providers: {} });

    expect(store.providers).toStrictEqual({});
    expect(forgotten).toStrictEqual(["a", "b"]);
  });

  it("only names the hosts on a dry run", async () => {
    const store = new InMemoryAgentModelStore({ a: "x" });

    const forgotten = await new RestoreAgentProviders(store).execute({
      providers: {},
      dryRun: true,
    });

    expect(store.providers).toStrictEqual({ a: "x" });
    expect(forgotten).toStrictEqual(["a"]);
  });
});
