import { posix } from "node:path";
import { describe, expect, it } from "vitest";
import {
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
});
