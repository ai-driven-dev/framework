import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";

describe("opencode hooks", () => {
  describe("buildContracts.flat().artifacts.hooks.path()", () => {
    const hooksArtifact = opencode.buildContracts?.flat?.().artifacts.hooks;
    if (hooksArtifact === undefined || !hooksArtifact.supported) {
      throw new Error("expected opencode's flat hooks artifact to be supported");
    }
    const path = hooksArtifact.path;

    it("namespaces a plain hook script under .opencode/hooks/<plugin>/", () => {
      expect(path("aidd-context", "hooks/update_memory.js")).toBe(
        ".opencode/hooks/aidd-context/update_memory.js"
      );
    });

    it("renames a plugin's own opencode-plugin.js flat into .opencode/plugin/<plugin>.js", () => {
      expect(path("aidd-telemetry", "hooks/opencode-plugin.js")).toBe(
        ".opencode/plugin/aidd-telemetry.js"
      );
    });

    it("keeps two plugins' same-named hook script from colliding", () => {
      const a = path("plugin-a", "hooks/x.js");
      const b = path("plugin-b", "hooks/x.js");
      expect(a).toBe(".opencode/hooks/plugin-a/x.js");
      expect(b).toBe(".opencode/hooks/plugin-b/x.js");
      expect(a).not.toBe(b);
    });
  });
});
