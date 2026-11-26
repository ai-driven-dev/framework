import { afterEach, describe, expect, it } from "vitest";
import { RegistrationRefusedError } from "../../../../src/contexts/host-registration/contract/host-registration.error.js";
import type { HostPluginServer } from "../../../../src/contexts/host-registration/ports/server/host-plugin-server.js";

/** How the host is: not installed, serving, or refusing every plugin call. */
export type PluginServerScenario = "absent" | "serving" | "refusing";

export interface PluginServerSubject {
  readonly server: HostPluginServer;
  /** Whether every server this subject started is gone. */
  stopped(): Promise<boolean>;
  dispose(): Promise<void>;
}

/** What taking plugins through a host's own server promises: availability never throws, an
 * install is listed and installing again keeps one, a removal of what is not there is done, a
 * refusal is typed, and no server is left running however the work ended. */
export function describePluginServerContract(
  subjectName: string,
  makeSubject: (scenario: PluginServerScenario) => Promise<PluginServerSubject>
): void {
  describe(`when the host's plugin server is ${subjectName}`, () => {
    const opened: PluginServerSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0).reverse()) await subject.dispose();
    });

    async function given(scenario: PluginServerScenario): Promise<PluginServerSubject> {
      const subject = await makeSubject(scenario);
      opened.push(subject);
      return subject;
    }

    it("is available when the host is installed, and not, without throwing, when it is not", async () => {
      expect((await given("serving")).server.isAvailable()).toBe(true);
      expect((await given("absent")).server.isAvailable()).toBe(false);
    });

    it("lists what it installed, from the directory it was given", async () => {
      const { server } = await given("serving");

      const { installed, listed } = await server.withSession(async (session) => ({
        installed: await session.install("/srv/aidd/plugins/p"),
        listed: await session.list(),
      }));

      expect(installed).toEqual({
        plugin: { id: "p", originalSource: "/srv/aidd/plugins/p", healthy: true },
      });
      expect(listed).toEqual([{ id: "p", originalSource: "/srv/aidd/plugins/p", healthy: true }]);
    });

    it("keeps one plugin when the same directory is installed twice", async () => {
      const { server } = await given("serving");

      const listed = await server.withSession(async (session) => {
        await session.install("/srv/aidd/plugins/p");
        await session.install("/srv/aidd/plugins/p");
        return session.list();
      });

      expect(listed.map((plugin) => plugin.id)).toEqual(["p"]);
    });

    it("removes a plugin, and counts removing one it does not hold as done", async () => {
      const { server } = await given("serving");

      const listed = await server.withSession(async (session) => {
        await session.install("/srv/aidd/plugins/p");
        await session.remove("p");
        await session.remove("p");
        return session.list();
      });

      expect(listed).toEqual([]);
    });

    it("returns the host's refusal of an install, and throws the typed error for a removal", async () => {
      const { server } = await given("refusing");

      const installed = await server.withSession((session) =>
        session.install("/srv/aidd/plugins/p")
      );

      expect(installed).toEqual({
        refusal: { detail: expect.stringContaining("/srv/aidd/plugins/p") },
      });
      await expect(server.withSession((session) => session.remove("p"))).rejects.toBeInstanceOf(
        RegistrationRefusedError
      );
    });

    it("leaves no server running after the work, whether it ended or threw", async () => {
      const subject = await given("serving");

      await subject.server.withSession(async (session) => session.list());
      await expect(
        subject.server.withSession(async () => {
          throw new Error("the work failed");
        })
      ).rejects.toThrow("the work failed");

      expect(await subject.stopped()).toBe(true);
    });
  });
}
