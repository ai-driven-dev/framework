import { afterEach, describe, expect, it } from "vitest";
import type { HostPluginRegistry } from "../../../../src/contexts/host-registration/contract/host-plugin-registry.js";

/** What the registry holds when it is asked. */
export type PluginRegistryScenario =
  | { kind: "holds"; ref: string; enabled: boolean }
  | { kind: "holds-nothing" }
  | { kind: "absent" }
  | { kind: "unreadable" };

export interface PluginRegistrySubject {
  readonly registry: HostPluginRegistry;
  readonly projectRoot: string;
  dispose(): Promise<void>;
}

/**
 * What a host's plugin registry reading promises: a ref it holds comes back with its enabled
 * flag, a registry that holds none is an empty answer, and only a registry that does not exist
 * says `absent`. A registry that exists and cannot be read says why, and never says `absent`.
 * `recordsDisabled` is false for a layout whose host has no notion of a disabled entry.
 */
export function describeHostPluginRegistryContract(
  subjectName: string,
  makeSubject: (scenario: PluginRegistryScenario) => Promise<PluginRegistrySubject>,
  options: { recordsDisabled?: boolean } = {}
): void {
  describe(`when the host plugin registry is ${subjectName}`, () => {
    const opened: PluginRegistrySubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function read(scenario: PluginRegistryScenario) {
      const subject = await makeSubject(scenario);
      opened.push(subject);
      return subject.registry.read(subject.projectRoot);
    }

    it("answers an enabled ref it holds", async () => {
      const reading = await read({ kind: "holds", ref: "p@m", enabled: true });

      expect(reading.refs?.get("p@m")?.enabled).toBe(true);
      expect(reading.absent).toBeUndefined();
      expect(reading.unreadable).toBeUndefined();
    });

    it.skipIf(options.recordsDisabled === false)("answers a disabled ref as disabled", async () => {
      const reading = await read({ kind: "holds", ref: "p@m", enabled: false });

      expect(reading.refs?.get("p@m")?.enabled).toBe(false);
    });

    it("answers an empty set when it holds no ref, not an absent registry", async () => {
      const reading = await read({ kind: "holds-nothing" });

      expect(reading.refs?.size).toBe(0);
      expect(reading.absent).toBeUndefined();
      expect(reading.unreadable).toBeUndefined();
    });

    it("says absent, and answers no ref, when the registry does not exist", async () => {
      const reading = await read({ kind: "absent" });

      expect(reading.absent).toBe(true);
      expect(reading.refs).toBeUndefined();
      expect(reading.unreadable).toBeUndefined();
    });

    it("says why, and never absent, when the registry exists and cannot be read", async () => {
      const reading = await read({ kind: "unreadable" });

      expect(reading.unreadable).toEqual(expect.any(String));
      expect(reading.refs).toBeUndefined();
      expect(reading.absent).toBeUndefined();
    });

    it("names the place it read", async () => {
      expect((await read({ kind: "absent" })).location).not.toBe("");
    });
  });
}
