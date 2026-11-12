import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { flatOf } from "../../../testing/plugin-mode.js";

describe("opencode plugins", () => {
  describe("capabilities.plugins", () => {
    it("is flat mode", () => {
      expect(opencode.plugins()?.kind).toBe("flat");
    });

    it("uses aidd- as flat namespace prefix", () => {
      expect(flatOf(opencode.plugins()).flatLayout().namespacePrefix).toBe("aidd-");
    });

    it("namespaces a plugin's hook scripts under .opencode/hooks/", () => {
      expect(flatOf(opencode.plugins()).flatLayout().hooksDir).toBe(".opencode/hooks/");
    });

    it("declares opencode-plugin.js as the loader's own module, landing in .opencode/plugin/", () => {
      expect(flatOf(opencode.plugins()).flatLayout().hooksLoaderEntry).toEqual({
        dir: ".opencode/plugin/",
        baseName: "opencode-plugin.js",
      });
    });

    it("places a hook script under its plugin, and the loader's own module beside the loader", () => {
      const plugins = flatOf(opencode.plugins());

      expect(plugins.hooksInstallPath("aidd-dev", "hooks/run.js")).toBe(
        ".opencode/hooks/aidd-dev/run.js"
      );
      expect(plugins.hooksInstallPath("aidd-dev", "hooks/opencode-plugin.js")).toBe(
        ".opencode/plugin/aidd-dev.js"
      );
    });
  });
});
