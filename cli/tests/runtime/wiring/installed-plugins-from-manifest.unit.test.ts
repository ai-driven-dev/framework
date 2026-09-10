import "../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { describe, expect, it } from "vitest";
import { Manifest } from "../../../src/contexts/framework/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/framework/domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../../src/contexts/framework/domain/ports/manifest-repository.js";
import { installedPluginsFromManifest } from "../../../src/runtime/wiring/installed-plugins-from-manifest.js";

function repo(manifest: Manifest | null): ManifestRepository {
  return {
    path: "/proj/.aidd/manifest.json",
    load: async () => manifest,
    save: async () => {},
    delete: async () => {},
  };
}

describe("installedPluginsFromManifest", () => {
  it("answers nothing at all when there is no manifest", async () => {
    expect(await installedPluginsFromManifest(repo(null)).read()).toBeNull();
  });

  it("lists only the tools that hold a plugin, by name and marketplace", async () => {
    const manifest = Manifest.create();
    manifest.addTool("claude", "1.0.0", []);
    manifest.addPlugin(
      "claude",
      InstalledPlugin.fromJSON({
        name: "aidd-dev",
        source: { kind: "local", path: "/p" },
        version: "1.0.0",
        strict: false,
        files: {},
        scope: "project",
        marketplace: "aidd-framework",
      })
    );

    const byTool = await installedPluginsFromManifest(repo(manifest)).read();

    expect([...(byTool ?? new Map()).entries()]).toStrictEqual([
      ["claude", [{ name: "aidd-dev", marketplace: "aidd-framework" }]],
    ]);
  });

  it("names the manifest file it reads", () => {
    expect(installedPluginsFromManifest(repo(null)).path).toBe("/proj/.aidd/manifest.json");
  });
});
