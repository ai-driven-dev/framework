import { describe, expect, it } from "vitest";
import type { FlatHooksBridge } from "../../../../../src/contexts/tools/contract/build-contract.js";
import { translateBuildLayout } from "../../../../shared/testing/build-files.builder.js";
import { aCanon } from "../../testing/canon-distribution.builder.js";
import {
  aStubBuildContract,
  aSupportedArtifact,
} from "../../testing/stub-build-contract.builder.js";

const MANIFEST = "hooks/hooks.json";

function bridge(generate: FlatHooksBridge["generate"] = () => "bridge"): FlatHooksBridge {
  return { dir: "flat/", skipIfSourceHas: "own.js", generate };
}

function flatHooks(
  files: Record<string, string>,
  over: Parameters<typeof aSupportedArtifact>[0] = {}
) {
  const contract = aStubBuildContract();
  const built = translateBuildLayout(
    aCanon("plug", files),
    {
      ...contract,
      artifacts: {
        ...contract.artifacts,
        hooks: aSupportedArtifact({
          placement: { kind: "hooks", scriptsDir: "flat/hooks/" },
          ...over,
        }),
        agents: { supported: false, reason: "off in this test" },
        skills: { supported: false, reason: "off in this test" },
        mcp: { supported: false, reason: "off in this test" },
      },
    },
    "flat"
  );
  return Object.fromEntries(built.map((file) => [file.relativePath, file.content]));
}

describe("the flat layout of a plugin's hooks", () => {
  it("carries every script below hooks, keeping its folders, and leaves the manifest to the merge", () => {
    expect(flatHooks({ [MANIFEST]: "{}", "hooks/run.sh": "a", "hooks/lib/x.js": "b" })).toEqual({
      "flat/hooks/plug/run.sh": "a",
      "flat/hooks/plug/lib/x.js": "b",
    });
  });

  it("takes only the plugin's own manifest for a manifest: a hooks.json further down is a script", () => {
    expect(
      flatHooks({ [MANIFEST]: "{}", "hooks/sub/hooks.json": "n", "hooks/my-hooks.json": "m" })
    ).toEqual({
      "flat/hooks/plug/sub/hooks.json": "n",
      "flat/hooks/plug/my-hooks.json": "m",
    });
  });

  it("builds nothing for a plugin declaring no hooks manifest", () => {
    expect(flatHooks({ "hooks/run.sh": "a" })).toEqual({});
  });

  it("hands each script to the tool's own script rewrite", () => {
    const script = (path: string, content: string) => `${path}:${content}`;
    expect(flatHooks({ [MANIFEST]: "{}", "hooks/run.sh": "a" }, { script })).toEqual({
      "flat/hooks/plug/run.sh": "hooks/run.sh:a",
    });
  });

  it("replaces the manifest with a bridge, raw, when the tool skips the manifest", () => {
    const hooksBridge = bridge((raw, plugin) => `${plugin}:${raw}`);
    expect(
      flatHooks({ [MANIFEST]: "{raw}", "hooks/run.sh": "a" }, { skipHooksJson: true, hooksBridge })
    ).toEqual({ "flat/plug-hooks.js": "plug:{raw}", "flat/hooks/plug/run.sh": "a" });
  });

  it("builds no bridge when the plugin ships the file the bridge replaces, wherever it sits", () => {
    const hooksBridge = bridge();
    expect(
      flatHooks(
        { [MANIFEST]: "{}", "hooks/sub/own.js": "mine" },
        { skipHooksJson: true, hooksBridge }
      )
    ).toEqual({ "flat/hooks/plug/sub/own.js": "mine" });
  });

  it("builds no bridge when no event maps to it", () => {
    const hooksBridge = bridge(() => null);
    expect(flatHooks({ [MANIFEST]: "{}" }, { skipHooksJson: true, hooksBridge })).toEqual({});
  });

  it("builds no bridge when the tool declares none", () => {
    expect(flatHooks({ [MANIFEST]: "{}" }, { skipHooksJson: true })).toEqual({});
  });
});
