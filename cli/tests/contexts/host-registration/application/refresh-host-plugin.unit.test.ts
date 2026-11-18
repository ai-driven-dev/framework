import { describe, expect, it } from "vitest";
import { RefreshHostPlugin } from "../../../../src/contexts/host-registration/application/refresh-host-plugin.js";
import type { RegistrationRecord } from "../../../../src/contexts/host-registration/domain/registration-record.js";
import type { HostPluginRegistry } from "../../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { FakeHostActions } from "../../../shared/testing/fake-host-actions.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.js";

const { copilot, codex } = TOOL;

const REF = "test-plugin@real-catalog";
const HOST = "real-catalog";
const registrations: RegistrationRecord = {
  binary: "copilot",
  marketplaces: [{ alias: "alias", hostName: HOST }],
  pluginRefs: [REF],
};
const reader = (refs?: ReadonlyMap<string, { enabled: boolean }>) =>
  ({ read: async () => ({ location: "/host/registry", refs }) }) satisfies HostPluginRegistry;
const enabled = () => new Map([[REF, { enabled: true }]]);
const refresh = (tool: typeof copilot, command: RefreshHostPlugin, recorded?: RegistrationRecord) =>
  command.execute({
    tool: registeredTools().aiProfile(tool),
    ref: REF,
    projectRoot: "/A",
    registrations: recorded,
  });

describe("refresh host plugin", () => {
  it.each([undefined, { ...registrations, marketplaces: [{ alias: "other", hostName: "other" }] }])(
    "requires a canonical catalogue matching the exact target ref",
    async (recorded) => {
      const activator = new FakeHostActions({ available: true });
      const command = new RefreshHostPlugin(
        new Map([[copilot, activator]]),
        new Map([[copilot, reader(enabled())]])
      );
      await expect(refresh(copilot, command, recorded)).rejects.toThrow(
        `copilot: ref '${REF}' has no canonical catalogue source proof; update refused.`
      );
      expect(activator.updatedPlugins).toEqual([]);
    }
  );

  it("refuses when the canonical catalogue is absent on the host", async () => {
    const activator = new FakeHostActions({ available: true });
    const command = new RefreshHostPlugin(
      new Map([[copilot, activator]]),
      new Map([[copilot, reader(enabled())]]),
      new Map([[copilot, { read: async () => ({ location: "/catalogue", entries: new Map() }) }]])
    );
    await expect(refresh(copilot, command, registrations)).rejects.toThrow(
      "copilot: catalogue source unproven."
    );
    expect(activator.updatedPlugins).toEqual([]);
  });

  it("requires the verified target-update verb before contacting a Codex host", async () => {
    const activator = new FakeHostActions({ available: true });
    const command = new RefreshHostPlugin(
      new Map([[codex, activator]]),
      new Map([[codex, reader(enabled())]])
    );
    await expect(refresh(codex, command)).rejects.toThrow(
      /does not support targeted native plugin update/
    );
    expect(activator.updatedPlugins).toEqual([]);
  });

  it("requires each independent Copilot update capability and keeps the claim on refusal", async () => {
    const activator = new FakeHostActions({ available: true });
    for (const command of [
      new RefreshHostPlugin(new Map(), new Map([[copilot, reader(enabled())]])),
      new RefreshHostPlugin(
        new Map([[copilot, new FakeHostActions({ available: false })]]),
        new Map([[copilot, reader(enabled())]])
      ),
      new RefreshHostPlugin(new Map([[copilot, activator]]), new Map()),
    ]) {
      await expect(refresh(copilot, command)).rejects.toThrow(
        /without its CLI and readable host registry/
      );
    }
    for (const registry of [
      reader(),
      reader(new Map()),
      reader(new Map([[REF, { enabled: false }]])),
    ]) {
      const command = new RefreshHostPlugin(
        new Map([[copilot, activator]]),
        new Map([[copilot, registry]])
      );
      await expect(refresh(copilot, command)).rejects.toThrow(/not provably enabled/);
    }
    const command = new RefreshHostPlugin(
      new Map([[copilot, activator]]),
      new Map([[copilot, reader(enabled())]])
    );
    await expect(refresh(copilot, command, registrations)).rejects.toThrow(
      /legacy claim has no source proof|source reader unavailable/
    );
    expect(activator.updatedPlugins).toEqual([]);
  });
});
