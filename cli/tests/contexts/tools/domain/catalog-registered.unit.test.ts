import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import { isAiTool, ToolCatalog } from "../../../../src/contexts/tools/domain/registry.js";

describe("what the registered profiles answer", () => {
  it("keeps every machine-local file inside its tool's directory", () => {
    const catalog = new ToolCatalog(REGISTERED_PROFILES);
    const aiProfiles = REGISTERED_PROFILES.filter(isAiTool);

    expect(aiProfiles.length).toBeGreaterThan(1);
    for (const profile of aiProfiles) {
      for (const path of catalog.machineLocalFilesOf(profile.toolId)) {
        expect(path.startsWith(profile.directory), `${profile.toolId}: ${path}`).toBe(true);
      }
    }
  });
});
