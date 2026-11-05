import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../src/contexts/tools/domain/build-contract.js";
import {
  flatHooksArtifact,
  flatHooksSupport,
  hooksBridgePath,
  hooksConfigCapability,
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

const bridge = (raw: string, plugin: string) => `${plugin}:${raw}`;

describe("a plugin tree's hooks artifact", () => {
  it("reads the plugin's hooks and keeps every path as authored", () => {
    const artifact = supported(pluginTreeHooksArtifact());

    expect(artifact.source).toStrictEqual(SOURCE);
    expect(artifact.path("aidd-dev", "hooks/journal.cjs")).toBe("hooks/journal.cjs");
  });
});

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
      flatHooksArtifact({ flat: { scriptsDir: ".tool/hooks/" } }, { tool: "cursor" })
    );

    expect(artifact.source).toStrictEqual(SOURCE);
    expect(artifact.path("aidd-dev", "hooks/lib/journal.cjs")).toBe(
      ".tool/hooks/aidd-dev/lib/journal.cjs"
    );
    expect(artifact.path("aidd-dev", "hooks/lib/hooks/a.cjs")).toBe(
      ".tool/hooks/aidd-dev/lib/hooks/a.cjs"
    );
    expect(artifact.path("aidd-dev", "hooks/aidd-dev.hooks.json")).toBe(
      ".tool/hooks/aidd-dev.hooks.json"
    );
  });

  it("merges into the route's shared file, through the engine, with the tool's own events", () => {
    const artifact = supported(
      flatHooksArtifact(
        {
          file: FLAT_FILE,
          eventMap: { Start: ["start"] },
          flat: { scriptsDir: ".tool/hooks/", sharedFile: ".tool/hooks.json" },
        },
        { tool: "cursor" }
      )
    );

    expect([artifact.hooksFile?.path("aidd-dev"), artifact.hooksFile?.shared]).toStrictEqual([
      ".tool/hooks.json",
      true,
    ]);
    expect(
      JSON.parse(artifact.hooksFile?.merge(null, SHIPPED, "p", locate).content ?? "")
    ).toStrictEqual({
      version: 1,
      hooks: { start: [{ command: "node ./.tool/hooks/p/a.cjs flat/skills/s" }] },
    });
  });

  it("finds the plugin's earlier entries after the root token the descriptor declares", () => {
    const artifact = supported(
      flatHooksArtifact(
        {
          rootToken: ROOT,
          file: FLAT_FILE,
          flat: { scriptsDir: ".tool/hooks/", sharedFile: ".tool/hooks.json" },
        },
        { tool: "cursor" }
      )
    );
    const existing = JSON.stringify({
      version: 1,
      hooks: { Start: [{ command: `node ${ROOT}/.tool/hooks/p/old.cjs` }] },
    });

    expect(
      JSON.parse(artifact.hooksFile?.merge(existing, "{}", "p", locate).content ?? "")
    ).toStrictEqual({ version: 1 });
  });

  it("writes a plugin's own file where the route shares none", () => {
    const artifact = supported(
      flatHooksArtifact(
        { file: FLAT_FILE, flat: { scriptsDir: ".tool/hooks/" } },
        { tool: "cursor" }
      )
    );

    expect([artifact.hooksFile?.path("aidd-dev"), artifact.hooksFile?.shared]).toStrictEqual([
      ".tool/hooks/aidd-dev.hooks.json",
      false,
    ]);
    expect(
      JSON.parse(artifact.hooksFile?.merge(null, SHIPPED, "p", locate).content ?? "")
    ).toStrictEqual({
      version: 1,
      hooks: { Start: [{ command: "node ./.tool/hooks/p/a.cjs flat/skills/s" }] },
    });
  });

  it("refuses, by its type, a bridge for a descriptor that declares a hooks file", () => {
    const declaresFile = {
      file: FLAT_FILE,
      flat: { scriptsDir: ".tool/hooks/", loaderEntry: LOADER },
    } as const;

    // @ts-expect-error a hooks file is merged for a tool, never fed to a bridge
    expect(() => flatHooksArtifact(declaresFile, { bridge })).not.toThrow();
  });

  it("writes no hooks file for a tool that reads none", () => {
    expect(
      supported(flatHooksArtifact({ flat: { scriptsDir: ".tool/hooks/" } }, { tool: "cursor" }))
        .hooksFile
    ).toBeUndefined();
  });

  it("delivers a loader's own module beside the loader, and every other script per plugin", () => {
    const artifact = supported(
      flatHooksArtifact(
        { flat: { scriptsDir: ".tool/hooks/", loaderEntry: LOADER } },
        { tool: "cursor" }
      )
    );

    expect(artifact.path("aidd-dev", "hooks/tool-plugin.js")).toBe(".tool/plugin/aidd-dev.js");
    expect(artifact.path("aidd-dev", "hooks/journal.cjs")).toBe(".tool/hooks/aidd-dev/journal.cjs");
  });

  it("replaces the hooks file with a generated bridge for a loader", () => {
    const artifact = supported(
      flatHooksArtifact({ flat: { scriptsDir: ".tool/hooks/", loaderEntry: LOADER } }, { bridge })
    );

    expect(artifact.skipHooksJson).toBe(true);
    expect(artifact.hooksBridge?.generate("{}", "aidd-dev")).toBe("aidd-dev:{}");
    expect(artifact.hooksBridge?.path("aidd-dev")).toBe(".tool/plugin/aidd-dev-hooks.js");
    expect(artifact.hooksBridge?.skipIfSourceHas).toBe("tool-plugin.js");
  });

  it("keeps the hooks file without a bridge", () => {
    const noBridge = supported(
      flatHooksArtifact(
        { flat: { scriptsDir: ".tool/hooks/", loaderEntry: LOADER } },
        { tool: "cursor" }
      )
    );

    expect([noBridge.skipHooksJson, noBridge.hooksBridge]).toStrictEqual([undefined, undefined]);
  });

  it("refuses, by its type, a bridge where no loader imports one", () => {
    const noLoader = { flat: { scriptsDir: ".tool/hooks/" } } as const;

    // @ts-expect-error a bridge is written beside a loader's module, and there is none
    expect(() => flatHooksArtifact(noLoader, { bridge })).not.toThrow();
  });
});

describe("the hooks file the framework install writes", () => {
  it("is read from the descriptor's own parameters", () => {
    const capability = hooksConfigCapability({
      config: {
        outputPath: ".tool/hooks.json",
        mergeStrategy: "none",
        entrySection: "Start",
        consumes: ["tool-hooks"],
      },
    });

    expect(capability.buildOutputPath()).toBe(".tool/hooks.json");
    expect(capability.getMergeStrategy()).toBe("none");
    expect(capability.getEntrySection()).toBe("Start");
    expect(capability.consumes).toStrictEqual(["tool-hooks"]);
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
    const support = projectHooksSupport({
      rootToken: ROOT,
      file: FLAT_FILE,
      eventMap: { Start: ["start"] },
      project: {
        pluginFile: "hooks.json",
        sharedFile: ".tool/hooks.json",
        scriptsDir: ".tool/hooks/",
      },
    });
    const { merge, unmerge, scriptPath, scriptDir } = support.projectHooksFormat;
    const merged = merge(null, SHIPPED, "p").content;

    expect([
      support.hooksRelativePath,
      support.hooksDestination,
      support.projectHooksRelativePath,
    ]).toStrictEqual(["hooks.json", "project", ".tool/hooks.json"]);
    expect(JSON.parse(merged)).toStrictEqual({
      version: 1,
      hooks: { start: [{ command: "node ./.tool/hooks/p/a.cjs skills/s" }] },
    });
    expect(JSON.parse(unmerge(merged, "p"))).toStrictEqual({ version: 1 });
    expect(scriptPath("p", "hooks/lib/a.cjs")).toBe(".tool/hooks/p/lib/a.cjs");
    expect(scriptDir("p")).toBe(".tool/hooks/p/");
    expect([
      support.projectHooksFormat.runsPluginScript("node ./.tool/hooks/p/a.cjs", "p"),
      support.projectHooksFormat.runsPluginScript("node ./x/.tool/hooks/p/a.cjs", "p"),
      support.projectHooksFormat.runsPluginScript(`node ${ROOT}/.tool/hooks/p/a.cjs`, "p"),
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a person's own shell variable
      support.projectHooksFormat.runsPluginScript("node ${HOME}/.tool/hooks/p/a.cjs", "p"),
    ]).toStrictEqual([true, false, true, false]);
  });
});
