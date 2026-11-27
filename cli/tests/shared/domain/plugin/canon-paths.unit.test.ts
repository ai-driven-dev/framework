import { posix } from "node:path";
import { describe, expect, it } from "vitest";
import {
  carriesRelease,
  HOST_ADAPTER_PATH,
  RELEASE_OWNER_PLUGIN,
  SOURCE_MARKETPLACE_RELATIVE,
  SOURCE_PLUGIN_MANIFEST_RELATIVE,
} from "../../../../src/shared/domain/plugin/canon-paths.js";

describe("canon paths", () => {
  it("keeps the plugin manifest and the marketplace catalog in one directory", () => {
    expect(posix.dirname(SOURCE_PLUGIN_MANIFEST_RELATIVE)).toBe(
      posix.dirname(SOURCE_MARKETPLACE_RELATIVE)
    );
    expect(posix.basename(SOURCE_PLUGIN_MANIFEST_RELATIVE)).not.toBe(
      posix.basename(SOURCE_MARKETPLACE_RELATIVE)
    );
  });

  describe("the plugin that carries the release of held answers", () => {
    const withAdapter = [{ relativePath: HOST_ADAPTER_PATH }];

    it("is the owner when it ships the host adapter", () => {
      expect(carriesRelease(RELEASE_OWNER_PLUGIN, withAdapter)).toBe(true);
    });

    it("is no other plugin, adapter or not", () => {
      expect(carriesRelease("another-plugin", withAdapter)).toBe(false);
    });

    it("is not the owner without the host adapter", () => {
      expect(carriesRelease(RELEASE_OWNER_PLUGIN, [{ relativePath: "hooks/hooks.json" }])).toBe(
        false
      );
    });
  });
});
