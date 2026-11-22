import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { BuiltMarketplaceEnsurer } from "../../../src/contexts/installation/contract/built-marketplace.js";
import {
  SYNTHETIC_NATIVE_TOOL,
  syntheticSyncCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import { PROJECT_ROOT, syncOf } from "../testing/sync-settings.builder.js";

/** This flow writes into a file it does not own: whatever a person put there survives, and a
 * trailing comma they left behind must not take the whole sync down with it. */
const sync = syncOf(syntheticSyncCatalog(), SYNTHETIC_NATIVE_TOOL);

describe("the settings file a user also edits", () => {
  it("writes the enabled plugin into a file that did not exist", async () => {
    const { written } = await sync();

    expect(written?.enabledPlugins).toEqual({ "aidd-context@aidd-framework": true });
  });

  it("keeps entries it did not put there", async () => {
    const { written } = await sync({
      settings: JSON.stringify({
        model: "opus",
        enabledPlugins: { "someone-elses@their-marketplace": true },
      }),
    });

    expect(written?.model).toBe("opus");
    expect(written?.enabledPlugins).toEqual({
      "someone-elses@their-marketplace": true,
      "aidd-context@aidd-framework": true,
    });
  });

  it("leaves a plugin somebody turned off turned off", async () => {
    // The sync adds a key only when it is absent. Adding it unconditionally would
    // silently re-enable a plugin on the next `aidd sync`.
    const { written } = await sync({
      settings: JSON.stringify({ enabledPlugins: { "aidd-context@aidd-framework": false } }),
    });

    expect(written?.enabledPlugins).toEqual({ "aidd-context@aidd-framework": false });
  });

  it("warns and carries on when the file is not valid JSON", async () => {
    // A trailing comma in a hand-edited file must not fail `setup`, `sync` and `update`.
    const { written, logger } = await sync({
      settings: '{ "enabledPlugins": { "a@b": true }, }',
    });

    expect(logger.warnMessages.some((w) => w.includes("malformed JSON"))).toBe(true);
    expect(written?.enabledPlugins).toEqual({ "aidd-context@aidd-framework": true });
  });

  it("treats a file holding an array as empty rather than merging into it", async () => {
    const { written } = await sync({ settings: JSON.stringify(["not", "an", "object"]) });

    expect(written?.enabledPlugins).toEqual({ "aidd-context@aidd-framework": true });
  });

  it("treats a file holding null as empty", async () => {
    const { written } = await sync({ settings: "null" });

    expect(written?.enabledPlugins).toEqual({ "aidd-context@aidd-framework": true });
  });

  it("treats a non-object under the key as empty rather than spreading it", async () => {
    const { written } = await sync({ settings: JSON.stringify({ enabledPlugins: ["a", "b"] }) });

    expect(written?.enabledPlugins).toEqual({ "aidd-context@aidd-framework": true });
  });
});

describe("what gets built, and how", () => {
  it("asks for a marketplace-mode build of every registered tree even when the CLI is absent", async () => {
    const requests: { name: string; mode: string }[] = [];
    const recordingBuild: BuiltMarketplaceEnsurer = {
      execute: async (options) => {
        requests.push({ name: options.marketplace.name, mode: options.mode });
        return { builtDir: `/built/${options.target}`, version: "test", rebuilt: true };
      },
    };

    await sync({
      marketplaceNames: ["aidd-framework", "unused"],
      ensureBuilt: recordingBuild,
      available: false,
    });

    expect(requests).toStrictEqual([
      { name: "aidd-framework", mode: "marketplace" },
      { name: "unused", mode: "marketplace" },
    ]);
  });
});

describe("a marketplace whose source the settings file cannot express", () => {
  it("writes no enabled-plugins entry for it", async () => {
    const { written, fs } = await sync({
      marketplaceSource: (name) => ({ kind: "url", url: `https://example.com/${name}.git` }),
    });

    expect(written).toBeUndefined();
    expect(fs.listUnder(resolve(PROJECT_ROOT))).toStrictEqual([]);
  });
});
