import { describe, expect, it } from "vitest";
import { translate } from "../../../../../src/contexts/translate/domain/engine.js";
import {
  HOST_ADAPTER_PATH,
  RELEASE_OWNER_PLUGIN,
} from "../../../../../src/shared/domain/plugin/canon-paths.js";
import { translateBuildLayout } from "../../../../shared/testing/build-files.builder.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";
import { CLAUDE_ROOT_TOKEN } from "../../testing/engine-kit.builder.js";
import {
  aStubBuildContract,
  aSupportedArtifact,
} from "../../testing/stub-build-contract.builder.js";

const PLUGIN = "plug";

function hooksBuilt(
  files: Record<string, string>,
  hooks = aSupportedArtifact(),
  pluginRootToken?: string
) {
  const contract = aStubBuildContract();
  const built = translateBuildLayout(
    aCanon(PLUGIN, files),
    {
      ...contract,
      pluginRootToken,
      artifacts: {
        ...contract.artifacts,
        hooks,
        agents: { supported: false, reason: "off in this test" },
        skills: { supported: false, reason: "off in this test" },
      },
    },
    "marketplace"
  );
  return Object.fromEntries(built.map((file) => [file.relativePath, file.content]));
}

describe("the marketplace layout of a plugin's hooks", () => {
  it("builds nothing for a plugin shipping no hooks", () => {
    expect(hooksBuilt({ "README.md": "# Readme" })).toEqual({});
  });

  it("carries every file under hooks, scripts included, at its own path", () => {
    expect(hooksBuilt({ "hooks/hooks.json": "{}", "hooks/lib/check.sh": "#!/bin/sh\n" })).toEqual({
      "plugins/plug/hooks/hooks.json": "{}",
      "plugins/plug/hooks/lib/check.sh": "#!/bin/sh\n",
    });
  });

  it("names the tool's own plugin root where the source names its own", () => {
    const built = hooksBuilt(
      { "hooks/lib/check.sh": `exec "${CLAUDE_ROOT_TOKEN}/hooks/x.sh"\n` },
      aSupportedArtifact(),
      "$" + "{PLUGIN_ROOT}"
    );
    expect(built["plugins/plug/hooks/lib/check.sh"]).toBe(
      `exec "${"$" + "{PLUGIN_ROOT}"}/hooks/x.sh"\n`
    );
  });

  it("writes hooks.json where the artifact places it and keeps every script at its own path", () => {
    expect(
      hooksBuilt(
        { "hooks/hooks.json": "{}", "hooks/lib/check.sh": "#!/bin/sh\n" },
        aSupportedArtifact({ placement: { kind: "file", at: "hooks.json" } })
      )
    ).toEqual({
      "plugins/plug/hooks.json": "{}",
      "plugins/plug/hooks/lib/check.sh": "#!/bin/sh\n",
    });
  });

  it("hands hooks.json, and no other file, to the transform", () => {
    const transform = (content: string, plugin: string, base: string) =>
      `${plugin}:${base}:${content}`;
    expect(
      hooksBuilt(
        { "hooks/hooks.json": "{}", "hooks/lib/notes.txt": "n" },
        aSupportedArtifact({ transform })
      )
    ).toEqual({
      "plugins/plug/hooks/hooks.json": "plug:hooks.json:{}",
      "plugins/plug/hooks/lib/notes.txt": "n",
    });
  });

  it("hands each file to the tool's script rewrite with its path in the plugin", () => {
    const script = (path: string, content: string) => `${path}|${content}`;
    expect(hooksBuilt({ "hooks/lib/a.sh": "x" }, aSupportedArtifact({ script }))).toEqual({
      "plugins/plug/hooks/lib/a.sh": "hooks/lib/a.sh|x",
    });
  });

  it("builds no hook for a tool that has none", () => {
    expect(
      hooksBuilt({ "hooks/hooks.json": "{}" }, { supported: false, reason: "off in this test" })
    ).toEqual({});
  });

  it("writes the hooks.json the tool converts them to, and reports what the conversion dropped", () => {
    const convertHooks = (json: string, plugin: string) => ({
      content: `${plugin}:${json}`,
      warnings: ["unmapped event 'SessionEnd' skipped"],
    });
    const contract = aStubBuildContract();
    const built = translate(aCanon(PLUGIN, { "hooks/hooks.json": "{}" }), {
      kind: "build",
      contract: {
        ...contract,
        artifacts: {
          ...contract.artifacts,
          hooks: aSupportedArtifact({ convertHooks }),
          agents: { supported: false, reason: "off in this test" },
          skills: { supported: false, reason: "off in this test" },
        },
      },
      mode: "marketplace",
      outDir: "/out",
    });

    expect({
      files: built.files.map((file) => [file.relativePath, file.content]),
      warnings: built.warnings,
    }).toEqual({
      files: [["plugins/plug/hooks/hooks.json", "plug:{}"]],
      warnings: ["unmapped event 'SessionEnd' skipped"],
    });
  });

  it.each([
    [RELEASE_OWNER_PLUGIN, true],
    ["another-plugin", false],
  ])("tells the conversion whether %s carries the release: %s", (plugin, carries) => {
    const seen: boolean[] = [];
    const convertHooks = (_json: string, _plugin: string, carriesRelease: boolean) => {
      seen.push(carriesRelease);
      return { content: "{}", warnings: [] };
    };
    const contract = aStubBuildContract();

    translate(aCanon(plugin, { "hooks/hooks.json": "{}", [HOST_ADAPTER_PATH]: "adapter" }), {
      kind: "build",
      contract: {
        ...contract,
        artifacts: {
          ...contract.artifacts,
          hooks: aSupportedArtifact({ convertHooks }),
          agents: { supported: false, reason: "off in this test" },
          skills: { supported: false, reason: "off in this test" },
        },
      },
      mode: "marketplace",
      outDir: "/out",
    });

    expect(seen).toEqual([carries]);
  });
});
