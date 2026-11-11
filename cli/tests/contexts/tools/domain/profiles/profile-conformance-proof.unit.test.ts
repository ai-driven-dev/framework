import { describe, expect, it } from "vitest";
import { aValidFileSubject, BROKEN_FILE_SUBJECTS } from "../../testing/broken-file-subjects.js";
import { aValidProfile, BROKEN_PROFILES } from "../../testing/broken-profiles.js";
import { PROFILE_CHECKS, registeredIdsMatchKernel } from "../../testing/profile-conformance.js";
import { PROFILE_FILE_CHECKS } from "../../testing/profile-file-conformance.js";
import { anIdeProfile } from "../../testing/profiles.js";

/** Each check is seen red against a subject spoiled in that one place, and green elsewhere. */
describe("the profile checks", () => {
  it("each has a broken subject, and no subject lacks a check", () => {
    expect(BROKEN_PROFILES.map((broken) => broken.title)).toEqual(
      PROFILE_CHECKS.map((check) => check.title)
    );
    expect(BROKEN_FILE_SUBJECTS.map((broken) => broken.title)).toEqual(
      PROFILE_FILE_CHECKS.map((check) => check.title)
    );
  });

  it.each(PROFILE_CHECKS.map((check) => check.title))(
    "all hold for a valid profile: %s",
    (title) => {
      const check = PROFILE_CHECKS.find((candidate) => candidate.title === title);
      expect(() => check?.holds(aValidProfile())).not.toThrow();
    }
  );

  it("all hold for a valid IDE profile", () => {
    const profile = anIdeProfile();
    for (const check of PROFILE_CHECKS) {
      expect(() => check.holds({ profile, registration: [profile] }), check.title).not.toThrow();
    }
  });

  describe.each(BROKEN_PROFILES)("$title", ({ title, subject }) => {
    it("fails its own broken profile", () => {
      const check = PROFILE_CHECKS.find((candidate) => candidate.title === title);
      expect(() => check?.holds(subject())).toThrow();
    });

    it("leaves every other check green on it", () => {
      const others = PROFILE_CHECKS.filter((candidate) => candidate.title !== title);
      for (const other of others) {
        expect(() => other.holds(subject()), other.title).not.toThrow();
      }
    });
  });
});

describe("the profile file checks", () => {
  it("all hold for a valid profile", () => {
    for (const check of PROFILE_FILE_CHECKS) {
      expect(() => check.holds(aValidFileSubject()), check.title).not.toThrow();
    }
  });

  describe.each(BROKEN_FILE_SUBJECTS)("$title", ({ title, subject }) => {
    it("fails its own broken profile", () => {
      const check = PROFILE_FILE_CHECKS.find((candidate) => candidate.title === title);
      expect(() => check?.holds(subject())).toThrow();
    });

    it("leaves every other check green on it", () => {
      const others = PROFILE_FILE_CHECKS.filter((candidate) => candidate.title !== title);
      for (const other of others) {
        expect(() => other.holds(subject()), other.title).not.toThrow();
      }
    });
  });
});

describe("registeredIdsMatchKernel", () => {
  it("refuses an id the kernel does not name, and a missing one", () => {
    expect(() => registeredIdsMatchKernel(["claude"])).toThrow();
  });
});
