import { describe, expect, it } from "vitest";
import { SyncServerPlugins } from "../../../../../src/contexts/host-registration/application/server/sync-server-plugins.use-case.js";
import { FakeHostPluginServer } from "../../../../shared/testing/fake-host-plugin-server.fake.js";
import { FakeServerPluginLedger } from "../../../../shared/testing/fake-server-plugin-ledger.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const BUILT = "/built/aidd/kimi";

function setup(options: { server?: FakeHostPluginServer; owned?: string[] } = {}) {
  const server = options.server ?? new FakeHostPluginServer();
  const ledger = new FakeServerPluginLedger(
    new Map(options.owned === undefined ? [] : [[TOOL.kimi, options.owned]])
  );
  const command = new SyncServerPlugins({
    hosts: { of: (toolId) => (toolId === TOOL.kimi ? { binary: "kimi", server } : undefined) },
    ledger,
  });
  return {
    server,
    ledger,
    run: (names: string[], toolId = TOOL.kimi, builtDir: string | null = BUILT) =>
      command.execute({ toolId, builtDir: async () => builtDir, names }),
  };
}

describe("installing plugins in a host's own server", () => {
  it("leaves a tool that takes plugins no such way alone", async () => {
    const { run, server } = setup();

    expect(await run(["aidd-dev"], TOOL.claude)).toEqual({ status: "unconfigured" });
    expect(server.sessionsOpened).toBe(0);
  });

  it("starts nothing and installs nothing when the host's binary is absent", async () => {
    const { run, server, ledger } = setup({
      server: new FakeHostPluginServer({ available: false }),
    });

    expect(await run(["aidd-dev"])).toEqual({ status: "binary-missing", binary: "kimi" });
    expect(server.sessionsOpened).toBe(0);
    expect(ledger.owned.size).toBe(0);
  });

  it("starts nothing when there is nothing to install and nothing owned", async () => {
    const { run, server } = setup();

    expect(await run([])).toEqual({ status: "installed", installed: [], problems: [] });
    expect(server.sessionsOpened).toBe(0);
  });

  it("installs nothing, and says the tree was not built, when there is no tree", async () => {
    const { run, server } = setup();

    expect(await run(["aidd-dev"], TOOL.kimi, null)).toEqual({ status: "unbuilt" });
    expect(server.sessionsOpened).toBe(0);
  });

  it("builds the tree only for a host that is there to take it", async () => {
    let builds = 0;
    const server = new FakeHostPluginServer({ available: false });
    const command = new SyncServerPlugins({
      hosts: { of: () => ({ binary: "kimi", server }) },
      ledger: new FakeServerPluginLedger(),
    });

    await command.execute({
      toolId: TOOL.kimi,
      names: ["aidd-dev"],
      builtDir: async () => {
        builds += 1;
        return BUILT;
      },
    });

    expect(builds).toBe(0);
  });

  it("installs each plugin from its built directory and records it as aidd's", async () => {
    const { run, server, ledger } = setup();

    expect(await run(["aidd-dev", "aidd-vcs"])).toEqual({
      status: "installed",
      installed: ["aidd-dev", "aidd-vcs"],
      problems: [],
    });
    expect(server.installedFrom).toEqual([
      `${BUILT}/plugins/aidd-dev`,
      `${BUILT}/plugins/aidd-vcs`,
    ]);
    expect(ledger.owned.get(TOOL.kimi)).toEqual(["aidd-dev", "aidd-vcs"]);
  });

  it("installs again every plugin it owns, whatever it was asked for", async () => {
    const { run, server, ledger } = setup({ owned: ["aidd-dev"] });

    const result = await run(["aidd-vcs"]);

    expect(result).toMatchObject({ installed: ["aidd-vcs", "aidd-dev"] });
    expect(server.installedFrom).toContain(`${BUILT}/plugins/aidd-dev`);
    expect(ledger.owned.get(TOOL.kimi)).toEqual(["aidd-dev", "aidd-vcs"]);
  });

  it("leaves a plugin that someone else installed under the same id, and says so", async () => {
    const server = new FakeHostPluginServer();
    server.held.set("aidd-dev", { id: "aidd-dev", originalSource: "/home/me/mine", healthy: true });
    const { run, ledger } = setup({ server });

    const result = await run(["aidd-dev", "aidd-vcs"]);

    expect(result).toEqual({
      status: "installed",
      installed: ["aidd-vcs"],
      problems: [expect.stringContaining("aidd-dev")],
    });
    expect(server.held.get("aidd-dev")?.originalSource).toBe("/home/me/mine");
    expect(ledger.owned.get(TOOL.kimi)).toEqual(["aidd-vcs"]);
  });

  it("takes over a plugin the host holds from the very directory it is installing", async () => {
    const server = new FakeHostPluginServer();
    server.held.set("aidd-dev", {
      id: "aidd-dev",
      originalSource: `${BUILT}/plugins/aidd-dev`,
      healthy: true,
    });
    const { run, ledger } = setup({ server });

    expect(await run(["aidd-dev"])).toMatchObject({ installed: ["aidd-dev"], problems: [] });
    expect(ledger.owned.get(TOOL.kimi)).toEqual(["aidd-dev"]);
  });

  it("reports a plugin the host refused, keeps going and does not claim it", async () => {
    const server = new FakeHostPluginServer({ refusing: true });
    const { run, ledger } = setup({ server });

    const result = await run(["aidd-dev"]);

    expect(result).toEqual({
      status: "installed",
      installed: [],
      problems: [expect.stringContaining("aidd-dev")],
    });
    expect(ledger.owned.size).toBe(0);
  });

  it("claims a plugin the host loaded with errors, and reports it", async () => {
    const server = new FakeHostPluginServer({ unhealthy: ["aidd-dev"] });
    const { run, ledger } = setup({ server });

    const result = await run(["aidd-dev"]);

    expect(result).toMatchObject({
      installed: ["aidd-dev"],
      problems: [expect.stringContaining("aidd-dev")],
    });
    expect(ledger.owned.get(TOOL.kimi)).toEqual(["aidd-dev"]);
  });
});
