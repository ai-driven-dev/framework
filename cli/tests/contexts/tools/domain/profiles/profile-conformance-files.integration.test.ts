import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../../src/composition/tool-profiles.composition.js";
import type { BuiltToolConfig } from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import { REPOSITORY_ROOT } from "../../../../shared/testing/repository-root.builder.js";
import { describeProfileFileConformance } from "../../testing/profile-file-conformance.contract.js";

/**
 * Adding a tool that runs hooks costs one `hooks:` descriptor in the profile, and one
 * payload the tool was seen sending. This reads the disk; the checks themselves are pure.
 */

// Resolved beside this file: a profile loaded from another copy of the package registers into
// that copy's registry, which this test does not read.
const PROFILES = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "src/contexts/tools/domain/profiles"
);
const PAYLOADS = join(REPOSITORY_ROOT, "scripts", "__tests__", "fixtures", "hook-payloads");

function hooksOf(profile: BuiltToolConfig): object | undefined {
  return profile.kind === "ai" ? profile.hooks : undefined;
}

describe("the profile files on disk", () => {
  it("read at least one tool that runs hooks and one that runs none", async () => {
    const declared = REGISTERED_PROFILES.map(hooksOf);
    expect(declared.some((hooks) => hooks !== undefined)).toBe(true);
    expect(declared.some((hooks) => hooks === undefined)).toBe(true);
    expect(REGISTERED_PROFILES.some((profile) => profile.kind === "ai")).toBe(true);
  });

  for (const profile of REGISTERED_PROFILES) {
    describeProfileFileConformance(profile.toolId, async () => ({
      profile,
      registration: REGISTERED_PROFILES,
      profileFolders: readdirSync(PROFILES, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name),
      hooks: hooksOf(profile),
      payloadFixtures: readdirSync(PAYLOADS),
    }));
  }
});
