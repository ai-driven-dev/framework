import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../../src/composition/tools.js";
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

async function hooksOf(profile: BuiltToolConfig): Promise<object | undefined> {
  if (profile.kind === "ai" && profile.hooks !== undefined) return profile.hooks;
  const file = join(PROFILES, profile.toolId, "hooks.ts");
  if (!existsSync(file)) return undefined;
  const descriptor: unknown = (await import(pathToFileURL(file).href))[
    `${profile.toolId.toUpperCase()}_HOOKS`
  ];
  return typeof descriptor === "object" && descriptor !== null ? descriptor : undefined;
}

describe("the profile files on disk", () => {
  it("read at least one tool that runs hooks and one that runs none", async () => {
    const declared = await Promise.all(REGISTERED_PROFILES.map(hooksOf));
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
      hooks: await hooksOf(profile),
      payloadFixtures: readdirSync(PAYLOADS),
    }));
  }
});
