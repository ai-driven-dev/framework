import { describe, expect, it } from "vitest";
import { RemoveServerPlugins } from "../../../../../src/contexts/host-registration/application/server/remove-server-plugins.use-case.js";
import { SyncServerPlugins } from "../../../../../src/contexts/host-registration/application/server/sync-server-plugins.use-case.js";
import { RegistrationRefusedError } from "../../../../../src/contexts/host-registration/contract/host-registration.error.js";
import { FakeHostPluginServer } from "../../../../shared/testing/fake-host-plugin-server.fake.js";
import { FakeServerPluginLedger } from "../../../../shared/testing/fake-server-plugin-ledger.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

function setup(options: { server?: FakeHostPluginServer; owned?: string[] } = {}) {
  const server = options.server ?? new FakeHostPluginServer();
  for (const id of options.owned ?? []) {
    server.held.set(id, { id, originalSource: `/built/plugins/${id}`, healthy: true });
  }
  server.held.set("mine", { id: "mine", originalSource: "/home/me/mine", healthy: true });
  const ledger = new FakeServerPluginLedger(
    new Map(options.owned === undefined ? [] : [[TOOL.kimi, options.owned]])
  );
  const deps = {
    hosts: {
      of: (toolId: string) => (toolId === TOOL.kimi ? { binary: "kimi", server } : undefined),
    },
    ledger,
  };
  const command = new RemoveServerPlugins(deps);
  return { server, ledger, command, sync: new SyncServerPlugins(deps) };
}

describe("removing the plugins aidd installed in a host's own server", () => {
  it("removes each plugin aidd owns, leaves every other one, and forgets what it removed", async () => {
    const { command, server, ledger } = setup({ owned: ["aidd-dev", "aidd-vcs"] });

    const removed = await command.execute();

    expect(removed).toEqual(new Map([[TOOL.kimi, ["aidd-dev", "aidd-vcs"]]]));
    expect([...server.held.keys()]).toEqual(["mine"]);
    expect(ledger.owned.size).toBe(0);
  });

  it("starts nothing when aidd owns nothing, even with the host's binary absent", async () => {
    const { command, server } = setup({ server: new FakeHostPluginServer({ available: false }) });

    expect(await command.execute()).toEqual(new Map());
    expect(server.sessionsOpened).toBe(0);
  });

  it("refuses, keeping what it owns, when the host's binary is absent and could not remove them", async () => {
    const { command, ledger } = setup({
      server: new FakeHostPluginServer({ available: false }),
      owned: ["aidd-dev"],
    });

    await expect(command.execute()).rejects.toThrow(RegistrationRefusedError);
    expect(ledger.owned.get(TOOL.kimi)).toEqual(["aidd-dev"]);
  });

  it("refuses, keeping what it owns, when the host refuses a removal", async () => {
    const { command, ledger } = setup({
      server: new FakeHostPluginServer({ refusing: true }),
      owned: ["aidd-dev"],
    });

    await expect(command.execute()).rejects.toThrow(RegistrationRefusedError);
    expect(ledger.owned.get(TOOL.kimi)).toEqual(["aidd-dev"]);
  });
});

describe("removing one plugin aidd installed in a host's own server", () => {
  it("removes that plugin alone and keeps the rest of what aidd owns", async () => {
    const { command, server, ledger } = setup({ owned: ["aidd-dev", "aidd-vcs"] });

    const removed = await command.execute({ plugin: "aidd-dev", toolIds: "all" });

    expect(removed).toEqual(new Map([[TOOL.kimi, ["aidd-dev"]]]));
    expect([...server.held.keys()].sort()).toEqual(["aidd-vcs", "mine"]);
    expect(ledger.owned.get(TOOL.kimi)).toEqual(["aidd-vcs"]);
  });

  it("forgets the tool once its last plugin is removed", async () => {
    const { command, ledger } = setup({ owned: ["aidd-dev"] });

    await command.execute({ plugin: "aidd-dev", toolIds: [TOOL.kimi] });

    expect(ledger.owned.size).toBe(0);
  });

  it("leaves a plugin it does not own, and a tool it was not asked about", async () => {
    const { command, server, ledger } = setup({ owned: ["aidd-dev"] });

    expect(await command.execute({ plugin: "mine", toolIds: "all" })).toEqual(new Map());
    expect(await command.execute({ plugin: "aidd-dev", toolIds: [TOOL.claude] })).toEqual(
      new Map()
    );
    expect(server.removed).toEqual([]);
    expect(ledger.owned.get(TOOL.kimi)).toEqual(["aidd-dev"]);
  });

  it("refuses, keeping what it owns, when the host's binary is absent", async () => {
    const { command, ledger } = setup({
      server: new FakeHostPluginServer({ available: false }),
      owned: ["aidd-dev"],
    });

    await expect(command.execute({ plugin: "aidd-dev", toolIds: "all" })).rejects.toThrow(
      RegistrationRefusedError
    );
    expect(ledger.owned.get(TOOL.kimi)).toEqual(["aidd-dev"]);
  });

  it("is not installed again by the next sync", async () => {
    const { command, sync, server } = setup({ owned: ["aidd-dev", "aidd-vcs"] });

    await command.execute({ plugin: "aidd-dev", toolIds: "all" });
    await sync.execute({ toolId: TOOL.kimi, names: [], builtDir: async () => "/built" });

    expect([...server.held.keys()]).not.toContain("aidd-dev");
  });
});
