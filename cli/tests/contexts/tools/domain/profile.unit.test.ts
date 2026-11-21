import { describe, expect, it } from "vitest";
import {
  isProfileSectionKey,
  PROFILE_SECTION_KEYS,
  type ProfileSectionKey,
} from "../../../../src/contexts/tools/domain/profile.js";

/** Typed over every key of `ProfileSections`, so a section added there fails to compile here
 * until it is listed. */
const EVERY_SECTION: Record<ProfileSectionKey, true> = {
  agents: true,
  skills: true,
  commands: true,
  rules: true,
  mcp: true,
  hooks: true,
  layout: true,
  manifest: true,
  config: true,
  models: true,
};

describe("PROFILE_SECTION_KEYS", () => {
  it("lists every section a profile can declare, once", () => {
    expect([...PROFILE_SECTION_KEYS].sort()).toStrictEqual(Object.keys(EVERY_SECTION).sort());
  });
});

describe("isProfileSectionKey", () => {
  it.each([...PROFILE_SECTION_KEYS])("accepts %s", (key) => {
    expect(isProfileSectionKey(key)).toBe(true);
  });

  it.each(["skill", "", "toString", "constructor"])("refuses %j", (name) => {
    expect(isProfileSectionKey(name)).toBe(false);
  });
});
