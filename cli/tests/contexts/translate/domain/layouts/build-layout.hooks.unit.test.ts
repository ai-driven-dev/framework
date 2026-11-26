import { describe, expect, it } from "vitest";
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
});
