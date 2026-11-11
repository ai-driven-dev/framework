import { afterEach, describe, expect, it } from "vitest";
import type { HostActions } from "../../../../src/contexts/host-registration/contract/host-actions.js";
import { NativePluginCliError } from "../../../../src/kernel/errors.js";

/** How the host's CLI behaves: not installed, installed and accepting, installed and refusing. */
export type HostActionsScenario = "absent" | "accepting" | "refusing";

export interface HostActionsSubject {
  readonly actions: HostActions;
  dispose(): Promise<void>;
}

/**
 * What driving a host's own CLI promises: availability never throws, an accepting host takes
 * every call, and a refusing one fails with the typed error rather than returning quietly.
 */
export function describeHostActionsContract(
  subjectName: string,
  makeSubject: (scenario: HostActionsScenario) => Promise<HostActionsSubject>
): void {
  describe(`when the host actions are ${subjectName}`, () => {
    const opened: HostActionsSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0).reverse()) await subject.dispose();
    });

    async function given(scenario: HostActionsScenario): Promise<HostActions> {
      const subject = await makeSubject(scenario);
      opened.push(subject);
      return subject.actions;
    }

    it("is available when the host's CLI is installed", async () => {
      expect((await given("accepting")).isAvailable()).toBe(true);
    });

    it("is not available, without throwing, when it is not installed", async () => {
      expect((await given("absent")).isAvailable()).toBe(false);
    });

    it("enables plugins through the CLI", async () => {
      expect((await given("accepting")).enablesPlugins()).toBe(true);
    });

    it("takes every call an accepting host is given", async () => {
      const actions = await given("accepting");

      expect(() => {
        actions.addMarketplace("/srv/aidd/market", "project");
        actions.enablePlugin("p@m", "project");
        actions.uninstallPlugin("p@m", "project");
        actions.upgradeMarketplaces("m");
        actions.removeMarketplace("m", "project");
      }).not.toThrow();
    });

    it.each([
      ["adding a marketplace", (a: HostActions) => a.addMarketplace("/srv/aidd/market", "project")],
      ["removing a marketplace", (a: HostActions) => a.removeMarketplace("m", "project")],
      ["enabling a plugin", (a: HostActions) => a.enablePlugin("p@m", "project")],
      ["uninstalling a plugin", (a: HostActions) => a.uninstallPlugin("p@m", "project")],
    ])("fails with the typed error when a refusing host is asked for %s", async (_label, call) => {
      const actions = await given("refusing");

      expect(() => call(actions)).toThrow(NativePluginCliError);
    });
  });
}
