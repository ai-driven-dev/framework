import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../src/contexts/tools/domain/build-contract.js";
import {
  flatHooksArtifact,
  flatHooksSupport,
  flatProjectHooksDelivery,
  hooksBridgePath,
  nativeHooksSupport,
  pluginTreeHooksArtifact,
  projectHooksSupport,
} from "../../../../../src/contexts/tools/domain/formats/hooks-descriptor.js";

const SOURCE = { kind: "hooksBundle", jsonPath: "hooks/hooks.json", scriptDir: "hooks" };
const LOADER = { dir: ".tool/plugin/", baseName: "tool-plugin.js" };

function supported(artifact: ArtifactContract): Extract<ArtifactContract, { supported: true }> {
  if (!artifact.supported) throw new Error("expected a supported artifact");
  return artifact;
}

const merge = (existing: string | null, incoming: string) => ({
  content: `${existing ?? ""}+${incoming}`,
  warnings: [],
});
const transform = (json: string) => `flat:${json}`;
const bridge = (raw: string, plugin: string) => `${plugin}:${raw}`;

describe("a plugin tree's hooks artifact", () => {
  it("reads the plugin's hooks and keeps every path as authored", () => {
    const artifact = supported(pluginTreeHooksArtifact());

    expect(artifact.source).toStrictEqual(SOURCE);
    expect(artifact.path("aidd-dev", "hooks/journal.cjs")).toBe("hooks/journal.cjs");
  });
});

describe("a flat build's hooks artifact", () => {
  it("puts each plugin's scripts in a folder of its own, and its hooks file beside them", () => {
    const artifact = supported(flatHooksArtifact({ scriptsDir: ".tool/hooks/" }));

    expect(artifact.source).toStrictEqual(SOURCE);
    expect(artifact.path("aidd-dev", "hooks/lib/journal.cjs")).toBe(
      ".tool/hooks/aidd-dev/lib/journal.cjs"
    );
    expect(artifact.path("aidd-dev", "hooks/aidd-dev.hooks.json")).toBe(
      ".tool/hooks/aidd-dev.hooks.json"
    );
  });

  it("merges into the route's shared file, under the output root", () => {
    const artifact = supported(
      flatHooksArtifact({ scriptsDir: ".tool/hooks/", sharedFile: ".tool/hooks.json" }, { merge })
    );

    expect(artifact.hooksMerge?.("a", "b", "aidd-dev")).toStrictEqual({
      content: "a+b",
      warnings: [],
    });
    expect(artifact.hooksMergeDest?.("/out")).toBe("/out/.tool/hooks.json");
  });

  it("merges nothing without a shared file, nor without a merge", () => {
    const noFile = supported(flatHooksArtifact({ scriptsDir: ".tool/hooks/" }, { merge }));
    const noMerge = supported(
      flatHooksArtifact({ scriptsDir: ".tool/hooks/", sharedFile: ".tool/hooks.json" })
    );

    expect([noFile.hooksMerge, noFile.hooksMergeDest]).toStrictEqual([undefined, undefined]);
    expect([noMerge.hooksMerge, noMerge.hooksMergeDest]).toStrictEqual([undefined, undefined]);
  });

  it("reshapes a plugin's own hooks file only when told how", () => {
    const route = { scriptsDir: ".tool/hooks/" };

    expect(supported(flatHooksArtifact(route, { transform })).hooksTransform?.("x")).toBe("flat:x");
    expect(supported(flatHooksArtifact(route)).hooksTransform).toBeUndefined();
  });

  it("delivers a loader's own module beside the loader, and every other script per plugin", () => {
    const artifact = supported(
      flatHooksArtifact({ scriptsDir: ".tool/hooks/", loaderEntry: LOADER })
    );

    expect(artifact.path("aidd-dev", "hooks/tool-plugin.js")).toBe(".tool/plugin/aidd-dev.js");
    expect(artifact.path("aidd-dev", "hooks/journal.cjs")).toBe(".tool/hooks/aidd-dev/journal.cjs");
  });

  it("replaces the hooks file with a generated bridge for a loader", () => {
    const artifact = supported(
      flatHooksArtifact({ scriptsDir: ".tool/hooks/", loaderEntry: LOADER }, { bridge })
    );

    expect(artifact.skipHooksJson).toBe(true);
    expect(artifact.hooksBridge?.generate("{}", "aidd-dev")).toBe("aidd-dev:{}");
    expect(artifact.hooksBridge?.path("aidd-dev")).toBe(".tool/plugin/aidd-dev-hooks.js");
    expect(artifact.hooksBridge?.skipIfSourceHas).toBe("tool-plugin.js");
  });

  it("keeps the hooks file without a bridge, or without a loader to import one", () => {
    const noBridge = supported(
      flatHooksArtifact({ scriptsDir: ".tool/hooks/", loaderEntry: LOADER })
    );
    const noLoader = supported(flatHooksArtifact({ scriptsDir: ".tool/hooks/" }, { bridge }));

    expect([noBridge.skipHooksJson, noBridge.hooksBridge]).toStrictEqual([undefined, undefined]);
    expect([noLoader.skipHooksJson, noLoader.hooksBridge]).toStrictEqual([undefined, undefined]);
  });
});

describe("where a plugin's bridge lands", () => {
  it("beside the loader's own module, named after the plugin", () => {
    expect(hooksBridgePath(LOADER, "aidd-dev")).toBe(".tool/plugin/aidd-dev-hooks.js");
  });
});

describe("a tool's plugins capability, as far as hooks go", () => {
  it("accepts hooks natively, with the root token and trust notice the descriptor names", () => {
    expect(nativeHooksSupport({ rootToken: "$ROOT", trustNotice: "trust it" })).toStrictEqual({
      acceptsHooks: true,
      pluginRootToken: "$ROOT",
      hooksTrustNotice: "trust it",
    });
    expect(nativeHooksSupport({})).toStrictEqual({ acceptsHooks: true });
  });

  it("accepts hooks flat, into the route's scripts folder", () => {
    expect(flatHooksSupport({ scriptsDir: ".tool/hooks/" }, bridge)).toStrictEqual({
      acceptsHooks: true,
      flatHooksDir: ".tool/hooks/",
    });
  });

  it("names the loader's module and the bridge generated for it", () => {
    const support = flatHooksSupport({ scriptsDir: ".tool/hooks/", loaderEntry: LOADER }, bridge);

    expect(support.flatHooksLoaderEntry).toStrictEqual(LOADER);
    expect(support.flatHooksBridge?.generate("{}", "p")).toBe("p:{}");
    expect(support.flatHooksBridge?.path("p")).toBe(".tool/plugin/p-hooks.js");
    expect(support.flatHooksBridge?.skipIfSourceHas).toBe("tool-plugin.js");
    expect(
      flatHooksSupport({ scriptsDir: ".tool/hooks/", loaderEntry: LOADER }).flatHooksBridge
    ).toBeUndefined();
  });

  it("merges an installed plugin's hooks into the project file the route names", () => {
    const format = {
      merge,
      unmerge: (existing: string) => existing,
      contributedEntries: () => [],
      isEmpty: () => true,
      scriptPath: (plugin: string, rel: string) => `${plugin}/${rel}`,
      scriptDir: (plugin: string) => `${plugin}/`,
    };

    expect(
      projectHooksSupport(
        {
          pluginFile: "hooks.json",
          entries: "flat",
          sharedFile: ".tool/hooks.json",
          scriptsDir: ".tool/hooks/",
        },
        format
      )
    ).toStrictEqual({
      hooksRelativePath: "hooks.json",
      hooksContentFormat: "flat",
      hooksDestination: "project",
      projectHooksRelativePath: ".tool/hooks.json",
      projectHooksFormat: format,
    });
  });

  it("merges a flat tool's installed hooks into its route's shared file", () => {
    const format = {
      merge,
      unmerge: (existing: string) => existing,
      contributedEntries: () => [],
      isEmpty: () => true,
      scriptPath: (plugin: string, rel: string) => `${plugin}/${rel}`,
      scriptDir: (plugin: string) => `${plugin}/`,
    };

    expect(
      flatProjectHooksDelivery(
        { scriptsDir: ".tool/hooks/", sharedFile: ".tool/hooks.json" },
        format
      )
    ).toStrictEqual({
      hooksDestination: "project",
      projectHooksRelativePath: ".tool/hooks.json",
      projectHooksFormat: format,
    });
  });
});
