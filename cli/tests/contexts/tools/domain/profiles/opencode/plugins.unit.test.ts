import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";

describe("opencode plugins", () => {
  describe("capabilities.plugins", () => {
    it("is flat mode", () => {
      expect(opencode.capabilities.plugins.buildMode()).toBe("flat");
    });

    it("uses aidd- as flat namespace prefix", () => {
      expect(opencode.capabilities.plugins.flatLayout().namespacePrefix).toBe("aidd-");
    });

    it("pluginsDir is null", () => {
      expect(opencode.capabilities.plugins.projectPluginsDir()).toBeNull();
    });

    it("pluginOutputDir returns null", () => {
      expect(opencode.capabilities.plugins.pluginOutputDir("my-plugin")).toBeNull();
    });

    it("namespaces a plugin's hook scripts under .opencode/hooks/", () => {
      expect(opencode.capabilities.plugins.flatLayout().hooksDir).toBe(".opencode/hooks/");
    });

    it("declares opencode-plugin.js as the loader's own module, landing in .opencode/plugin/", () => {
      expect(opencode.capabilities.plugins.flatLayout().hooksLoaderEntry).toEqual({
        dir: ".opencode/plugin/",
        baseName: "opencode-plugin.js",
      });
    });
  });
});
