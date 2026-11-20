import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../../src/composition/installation.js";
import { ListRegisteredPlugins } from "../../../../../src/contexts/installation/application/doctor/list-registered-plugins.js";
import { LoadManifest } from "../../../../../src/contexts/installation/application/doctor/load-manifest.js";
import { InstalledPlugin } from "../../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const source = { kind: "local", path: "/p" } as const;

function listerOver(manifest: ReturnType<ReturnType<typeof aManifest>["build"]>) {
  return new ListRegisteredPlugins(
    new LoadManifest(new InMemoryManifestRepository(manifest)),
    registrationRecordRules
  );
}

describe("ListRegisteredPlugins", () => {
  it("expects the refs a tool's host registration recorded", async () => {
    const manifest = aManifest().withTool(TOOL.claude, []).build();
    manifest.setNativeRegistrations(TOOL.claude, {
      binary: "claude",
      marketplaces: [{ alias: "m", hostName: "m" }],
      pluginRefs: ["a@m"],
    });

    await expect(listerOver(manifest).execute({ allowedIds: null })).resolves.toEqual({
      tools: [{ toolId: TOOL.claude, expectedPlugins: [{ plugin: "a@m", ref: "a@m" }] }],
    });
  });

  it("falls back to the tracked plugins when nothing was registered", async () => {
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(
        TOOL.claude,
        InstalledPlugin.fromMetadata("a", "1.0.0", source, false, "project", "m")
      )
      .withPlugin(TOOL.claude, InstalledPlugin.fromMetadata("b", "1.0.0", source, false, "project"))
      .build();

    await expect(listerOver(manifest).execute({ allowedIds: null })).resolves.toEqual({
      tools: [
        {
          toolId: TOOL.claude,
          expectedPlugins: [
            { plugin: "a", ref: "a@m" },
            { plugin: "b", ref: undefined },
          ],
        },
      ],
    });
  });

  it("lists only the allowed tools", async () => {
    const manifest = aManifest().withTool(TOOL.claude, []).withTool(TOOL.cursor, []).build();

    const { tools } = await listerOver(manifest).execute({ allowedIds: new Set([TOOL.cursor]) });

    expect(tools.map((t) => t.toolId)).toEqual([TOOL.cursor]);
  });
});
