import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../../../src/composition/installation.js";
import {
  ListRegisteredPlugins,
  type ListRegisteredPluginsRequest,
} from "../../../../../src/contexts/installation/application/doctor/list-registered-plugins.use-case.js";
import { LoadManifest } from "../../../../../src/contexts/installation/application/doctor/load-manifest.use-case.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { RegistrationRecords } from "../../../../../src/contexts/installation/ports/record/registration-records.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "../../testing/manifest.builder.js";

const source = { kind: "local", path: "/p" } as const;

function listerOver(
  manifest: ReturnType<ReturnType<typeof aManifest>["build"]>,
  records: RegistrationRecords = new Map()
) {
  const repo = new InMemoryManifestRepository(manifest, undefined, records);
  const lister = new ListRegisteredPlugins(new LoadManifest(repo), repo);
  return {
    execute: (command: Pick<ListRegisteredPluginsRequest, "allowedIds">) =>
      lister.execute({ ...command, records: registrationRecordRules }),
  };
}

describe("listing the plugins registered with the hosts", () => {
  it("expects the refs a tool's host registration recorded", async () => {
    const manifest = aManifest().withTool(TOOL.claude, []).build();
    const records: RegistrationRecords = new Map([
      [
        TOOL.claude,
        {
          binary: "claude",
          marketplaces: [{ alias: "m", hostName: "m" }],
          pluginRefs: ["a@m"],
        },
      ],
    ]);

    await expect(listerOver(manifest, records).execute({ allowedIds: null })).resolves.toEqual({
      tools: [{ toolId: TOOL.claude, expectedPlugins: [{ plugin: "a@m", ref: "a@m" }] }],
    });
  });

  it("falls back to the tracked plugins when nothing was registered", async () => {
    const manifest = aManifest()
      .withTool(TOOL.claude, [])
      .withPlugin(
        TOOL.claude,
        RecordedPlugin.fromMetadata({
          name: "a",
          version: "1.0.0",
          source,
          strict: false,
          scope: "project",
          marketplace: "m",
        })
      )
      .withPlugin(
        TOOL.claude,
        RecordedPlugin.fromMetadata({
          name: "b",
          version: "1.0.0",
          source,
          strict: false,
          scope: "project",
        })
      )
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
