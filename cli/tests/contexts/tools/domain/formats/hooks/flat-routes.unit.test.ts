import { describe, expect, it } from "vitest";
import { artifactPath } from "../../../../../../src/contexts/tools/contract/artifact-path.js";
import type {
  ArtifactContract,
  ShippedHooks,
} from "../../../../../../src/contexts/tools/contract/build-contract.js";
import {
  flatHooksArtifact,
  flatHooksSupport,
  flatProjectHooksDelivery,
  hooksBridgePath,
} from "../../../../../../src/contexts/tools/domain/formats/hooks/flat-routes.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { routed } from "../../../../../shared/testing/routed-hooks.builder.js";

const SOURCE = { kind: "hooksBundle", jsonPath: "hooks/hooks.json", scriptDir: "hooks" };
const LOADER = { dir: ".tool/plugin/", baseName: "tool-plugin.js" };

function supported(artifact: ArtifactContract): Extract<ArtifactContract, { supported: true }> {
  if (!artifact.supported) throw new Error("expected a supported artifact");
  return artifact;
}

const bridge = (raw: string, plugin: string) => `${plugin}:${raw}`;

const FLAT_FILE = {
  wrapper: { version: 1 },
  entries: { shape: "flat", fieldsKept: ["command"] },
} as const;
// biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a plugin's hooks name
const ROOT = "${CLAUDE_PLUGIN_ROOT}";
const SHIPPED = JSON.stringify({
  hooks: { Start: [{ hooks: [{ command: `node ${ROOT}/hooks/a.cjs ${ROOT}/skills/s` }] }] },
});
const locate = (path: string) => `flat/${path}`;

describe("a flat build's hooks artifact", () => {
  it("puts each plugin's scripts in a folder of its own, and its hooks file beside them", () => {
    const artifact = supported(
      flatHooksArtifact(routed({ flat: { scriptsDir: ".tool/hooks/" } }), { tool: TOOL.cursor })
    );

    expect(artifact.source).toStrictEqual(SOURCE);
    expect(artifactPath(artifact, "aidd-dev", "hooks/lib/journal.cjs")).toBe(
      ".tool/hooks/aidd-dev/lib/journal.cjs"
    );
    expect(artifactPath(artifact, "aidd-dev", "hooks/lib/hooks/a.cjs")).toBe(
      ".tool/hooks/aidd-dev/lib/hooks/a.cjs"
    );
    expect(artifactPath(artifact, "aidd-dev", "hooks/aidd-dev.hooks.json")).toBe(
      ".tool/hooks/aidd-dev.hooks.json"
    );
  });

  it("merges into the route's shared file, through the engine, with the tool's own events", () => {
    const artifact = supported(
      flatHooksArtifact(
        routed({
          file: FLAT_FILE,
          eventMap: { Start: ["start"] },
          undeclaredEvents: "skipped",
          flat: { scriptsDir: ".tool/hooks/", sharedFile: ".tool/hooks.json" },
        }),
        { tool: TOOL.cursor }
      )
    );

    expect([artifact.hooksFile?.path("aidd-dev"), artifact.hooksFile?.shared]).toStrictEqual([
      ".tool/hooks.json",
      true,
    ]);
    expect(
      JSON.parse(
        artifact.hooksFile?.merge(null, { json: SHIPPED, plugin: "p", locate }).content ?? ""
      )
    ).toStrictEqual({
      version: 1,
      hooks: { start: [{ command: "node ./.tool/hooks/p/a.cjs flat/skills/s" }] },
    });
  });

  it("finds the plugin's earlier entries after the root token the descriptor declares", () => {
    const artifact = supported(
      flatHooksArtifact(
        routed({
          rootToken: ROOT,
          file: FLAT_FILE,
          flat: { scriptsDir: ".tool/hooks/", sharedFile: ".tool/hooks.json" },
        }),
        { tool: TOOL.cursor }
      )
    );
    const existing = JSON.stringify({
      version: 1,
      hooks: { Start: [{ command: `node ${ROOT}/.tool/hooks/p/old.cjs` }] },
    });

    expect(
      JSON.parse(
        artifact.hooksFile?.merge(existing, { json: "{}", plugin: "p", locate }).content ?? ""
      )
    ).toStrictEqual({ version: 1 });
  });

  it("writes a plugin's own file where the route shares none", () => {
    const artifact = supported(
      flatHooksArtifact(routed({ file: FLAT_FILE, flat: { scriptsDir: ".tool/hooks/" } }), {
        tool: TOOL.cursor,
      })
    );

    expect([artifact.hooksFile?.path("aidd-dev"), artifact.hooksFile?.shared]).toStrictEqual([
      ".tool/hooks/aidd-dev.hooks.json",
      false,
    ]);
    expect(
      JSON.parse(
        artifact.hooksFile?.merge(null, { json: SHIPPED, plugin: "p", locate }).content ?? ""
      )
    ).toStrictEqual({
      version: 1,
      hooks: { Start: [{ command: "node ./.tool/hooks/p/a.cjs flat/skills/s" }] },
    });
  });

  it("merges through a tool's own merge where no file format describes its hooks file", () => {
    const ownMerge = (existing: string | null, { json, plugin }: ShippedHooks) => ({
      content: `${existing ?? ""}+${json}@${plugin}`,
      warnings: [],
    });
    const artifact = supported(
      flatHooksArtifact(
        routed({ flat: { scriptsDir: ".tool/hooks/", sharedFile: ".tool/hooks.json" } }),
        { tool: TOOL.cursor },
        ownMerge
      )
    );

    expect([artifact.hooksFile?.path("p"), artifact.hooksFile?.shared]).toStrictEqual([
      ".tool/hooks.json",
      true,
    ]);
    expect(artifact.hooksFile?.merge(null, { json: "h", plugin: "p", locate }).content).toBe(
      "+h@p"
    );
  });

  it("refuses, by its type, a bridge for a descriptor that declares a hooks file", () => {
    const declaresFile = {
      file: FLAT_FILE,
      flat: { scriptsDir: ".tool/hooks/", loaderEntry: LOADER },
    } as const;

    // @ts-expect-error a hooks file is merged for a tool, never fed to a bridge
    expect(() => flatHooksArtifact(routed(declaresFile), { bridge })).not.toThrow();
  });

  it("writes no hooks file for a tool that reads none", () => {
    expect(
      supported(
        flatHooksArtifact(routed({ flat: { scriptsDir: ".tool/hooks/" } }), { tool: TOOL.cursor })
      ).hooksFile
    ).toBeUndefined();
  });

  it("delivers a loader's own module beside the loader, and every other script per plugin", () => {
    const artifact = supported(
      flatHooksArtifact(routed({ flat: { scriptsDir: ".tool/hooks/", loaderEntry: LOADER } }), {
        tool: TOOL.cursor,
      })
    );

    expect(artifactPath(artifact, "aidd-dev", "hooks/tool-plugin.js")).toBe(
      ".tool/plugin/aidd-dev.js"
    );
    expect(artifactPath(artifact, "aidd-dev", "hooks/journal.cjs")).toBe(
      ".tool/hooks/aidd-dev/journal.cjs"
    );
  });

  it("replaces the hooks file with a generated bridge for a loader", () => {
    const artifact = supported(
      flatHooksArtifact(routed({ flat: { scriptsDir: ".tool/hooks/", loaderEntry: LOADER } }), {
        bridge,
      })
    );

    expect(artifact.skipHooksJson).toBe(true);
    expect(artifact.hooksBridge?.generate("{}", "aidd-dev")).toBe("aidd-dev:{}");
    expect(artifact.hooksBridge?.path("aidd-dev")).toBe(".tool/plugin/aidd-dev-hooks.js");
    expect(artifact.hooksBridge?.skipIfSourceHas).toBe("tool-plugin.js");
  });

  it("keeps the hooks file without a bridge", () => {
    const noBridge = supported(
      flatHooksArtifact(routed({ flat: { scriptsDir: ".tool/hooks/", loaderEntry: LOADER } }), {
        tool: TOOL.cursor,
      })
    );

    expect([noBridge.skipHooksJson, noBridge.hooksBridge]).toStrictEqual([undefined, undefined]);
  });

  it("refuses, by its type, a bridge where no loader imports one", () => {
    const noLoader = { flat: { scriptsDir: ".tool/hooks/" } } as const;

    // @ts-expect-error a bridge is written beside a loader's module, and there is none
    expect(() => flatHooksArtifact(routed(noLoader), { bridge })).not.toThrow();
  });
});

describe("where a plugin's bridge lands", () => {
  it("beside the loader's own module, named after the plugin", () => {
    expect(hooksBridgePath(LOADER, "aidd-dev")).toBe(".tool/plugin/aidd-dev-hooks.js");
  });
});

describe("a flat tool's plugins capability, as far as hooks go", () => {
  it("accepts hooks flat, into the route's scripts folder", () => {
    expect(
      flatHooksSupport(routed({ flat: { scriptsDir: ".tool/hooks/" } }), bridge)
    ).toStrictEqual({
      kind: "bridge",
      flat: { dir: ".tool/hooks/" },
    });
  });

  it("names the loader's module and the bridge generated for it", () => {
    const support = flatHooksSupport(
      routed({ flat: { scriptsDir: ".tool/hooks/", loaderEntry: LOADER } }),
      bridge
    );

    expect(support.flat.loaderEntry).toStrictEqual(LOADER);
    expect(support.flat.bridge?.generate("{}", "p")).toBe("p:{}");
    expect(support.flat.bridge?.path("p")).toBe(".tool/plugin/p-hooks.js");
    expect(support.flat.bridge?.skipIfSourceHas).toBe("tool-plugin.js");
    expect(
      flatHooksSupport(routed({ flat: { scriptsDir: ".tool/hooks/", loaderEntry: LOADER } })).flat
        .bridge
    ).toBeUndefined();
  });

  it("merges a flat tool's installed hooks into its route's shared file", () => {
    const format = {
      merge: () => ({ content: "", warnings: [] }),
      unmerge: (existing: string) => existing,
      contributedEntries: () => [],
      isEmpty: () => true,
      scriptPath: (plugin: string, rel: string) => `${plugin}/${rel}`,
      scriptDir: (plugin: string) => `${plugin}/`,
    };

    expect(
      flatProjectHooksDelivery(
        flatHooksSupport(routed({ flat: { scriptsDir: ".tool/hooks/" } })),
        { scriptsDir: ".tool/hooks/", sharedFile: ".tool/hooks.json" },
        format
      )
    ).toStrictEqual({
      kind: "project-merge",
      project: { relativePath: ".tool/hooks.json", format },
      flat: { dir: ".tool/hooks/" },
    });
  });
});
