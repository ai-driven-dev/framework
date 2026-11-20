import { describe, expect, it } from "vitest";
import type { Platform } from "../../../../src/contexts/installation/ports/platform.js";

export interface PlatformSubject {
  readonly platform: Platform;
  /** The name the subject is set up to report, or the one the running system has. */
  readonly expected: string;
}

/** What naming the platform promises, whatever answers it. */
export function describePlatformContract(
  subjectName: string,
  makeSubject: () => PlatformSubject
): void {
  describe(`when the platform is named ${subjectName}`, () => {
    it("names the platform it runs on", () => {
      const { platform, expected } = makeSubject();

      expect(platform.current()).toBe(expected);
    });

    it("names it the way Node does, lowercase and without a version", () => {
      const { platform } = makeSubject();

      expect(platform.current()).toMatch(/^[a-z0-9]+$/);
    });
  });
}
