import { describe, expect, it } from "vitest";
import { RemoveServerPlugins } from "../../../../../src/contexts/host-registration/application/server/remove-server-plugins.use-case.js";
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
  const command = new RemoveServerPlugins({
    hosts: { of: (toolId) => (toolId === TOOL.kimi ? { binary: "kimi", server } : undefined) },
    ledger,
  });
  return { server, ledger, command };
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
