import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../src/contexts/tools/domain/profiles/registered-profiles.js";

describe("what the registered profiles answer", () => {
  it("keeps every machine-local file inside its tool's directory", () => {
    const aiProfiles = REGISTERED_PROFILES.filter((profile) => profile.kind === "ai");

    expect(aiProfiles.length).toBeGreaterThan(1);
    for (const profile of aiProfiles) {
      for (const path of profile.marketplaceRegistration()?.machineLocalFiles() ?? []) {
        expect(path.startsWith(profile.directory), `${profile.toolId}: ${path}`).toBe(true);
      }
    }
  });
});
