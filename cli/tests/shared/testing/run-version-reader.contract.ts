import { describe, expect, it } from "vitest";
import type { VersionReader } from "../../../src/shared/ports/version-reader.js";

const SEMVER_PREFIX = /^\d+\.\d+\.\d+/;

/** What the version reader promises, stated once and run against every implementation of it. */
export function describeVersionReaderContract(
  subjectName: string,
  makeReader: () => VersionReader
) {
  describe(`when the version reader is ${subjectName}`, () => {
    it("answers a semantic version", () => {
      expect(makeReader().get()).toMatch(SEMVER_PREFIX);
    });
  });
}
