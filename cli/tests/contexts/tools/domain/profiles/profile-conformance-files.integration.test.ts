import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import { isAiTool } from "../../../../../src/contexts/tools/domain/registry.js";
import { REPOSITORY_ROOT } from "../../../../helpers/repository-root.js";
import { describeProfileFileConformance } from "../../testing/profile-file-conformance.js";

/**
 * Adding a tool that runs hooks costs one descriptor, `profiles/<tool>/hooks.ts`, and one
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

async function hooksModuleOf(toolId: string): Promise<Readonly<Record<string, unknown>> | null> {
  const file = join(PROFILES, toolId, "hooks.ts");
  return existsSync(file) ? await import(pathToFileURL(file).href) : null;
}

describe("the profile files on disk", () => {
  it("read at least one tool that runs hooks and one that runs none", async () => {
    const modules = await Promise.all(REGISTERED_PROFILES.map((p) => hooksModuleOf(p.toolId)));
    expect(modules.some((module) => module !== null)).toBe(true);
    expect(modules.some((module) => module === null)).toBe(true);
    expect(REGISTERED_PROFILES.some(isAiTool)).toBe(true);
  });

  for (const profile of REGISTERED_PROFILES) {
    describeProfileFileConformance(profile.toolId, async () => ({
      profile,
      registration: REGISTERED_PROFILES,
      profileFolders: readdirSync(PROFILES, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name),
      hooksModule: await hooksModuleOf(profile.toolId),
      payloadFixtures: readdirSync(PAYLOADS),
    }));
  }
});
