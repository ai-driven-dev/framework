import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../src/contexts/tools/contract/build-contract.js";
import {
  flatHooksArtifact,
  flatHooksSupport,
  flatProjectHooksDelivery,
  type HooksBrand,
  hooksBridgePath,
  hooksConfigPart,
  nativeHooksSupport,
  pluginTreeHooksArtifact,
  projectHooksSupport,
} from "../../../../../src/contexts/tools/domain/formats/hooks-descriptor.js";
import { CapabilityConfigError } from "../../../../../src/kernel/errors.js";

const SOURCE = { kind: "hooksBundle", jsonPath: "hooks/hooks.json", scriptDir: "hooks" };
const LOADER = { dir: ".tool/plugin/", baseName: "tool-plugin.js" };

function supported(artifact: ArtifactContract): Extract<ArtifactContract, { supported: true }> {
  if (!artifact.supported) throw new Error("expected a supported artifact");
  return artifact;
}

/** A literal standing in for a declared descriptor: only the builders' reading of it is under test. */
function routed<T extends object>(routing: T): HooksBrand & T {
  return routing as HooksBrand & T;
}

const bridge = (raw: string, plugin: string) => `${plugin}:${raw}`;

describe("a plugin tree's hooks artifact", () => {
  it("refuses, by its type, a literal object where a declared descriptor is taken", () => {
    // @ts-expect-error only declareHooks yields a descriptor
    expect(() => pluginTreeHooksArtifact({ flat: { scriptsDir: ".tool/hooks/" } })).not.toThrow();
  });

  it("reads the plugin's hooks and keeps every path as authored", () => {
    const artifact = supported(pluginTreeHooksArtifact(routed({})));

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

const RUNTIME = { adapter: "the tool's adapter" };
const HOST = "hooks/lib/host.cjs";

describe("the host adapter a build puts behind a plugin's hooks", () => {
  it("replaces the plugin's own adapter in the plugin tree, and nothing else", () => {
    const artifact = supported(pluginTreeHooksArtifact(routed({ runtime: RUNTIME })));

    expect([
      artifact.script?.(HOST, "claude's"),
      artifact.script?.("hooks/host.cjs", "own"),
      artifact.script?.("hooks/lib/host.cjs.bak", "own"),
    ]).toStrictEqual(["the tool's adapter", "own", "own"]);
  });

  it("replaces it on a flat build", () => {
    const artifact = supported(
      flatHooksArtifact(routed({ runtime: RUNTIME, flat: { scriptsDir: ".tool/hooks/" } }), {
        tool: "cursor",
      })
    );

    expect(artifact.script?.(HOST, "claude's")).toBe("the tool's adapter");
  });

  it("replaces it on a native install, and on a flat one", () => {
    const native = nativeHooksSupport(routed({ runtime: RUNTIME, rootToken: "$ROOT" }));
    const flat = flatHooksSupport(
      routed({ runtime: RUNTIME, flat: { scriptsDir: ".tool/hooks/" } })
    );

    expect([
      native.delivery.hookScript?.(HOST, "claude's"),
      flat.hookScript?.(HOST, "claude's"),
    ]).toStrictEqual(["the tool's adapter", "the tool's adapter"]);
  });

  it("leaves every script as shipped where the descriptor names no adapter", () => {
    expect([
      supported(pluginTreeHooksArtifact(routed({}))).script,
      nativeHooksSupport(routed({ rootToken: "$ROOT" })).delivery.hookScript,
      flatHooksSupport(routed({ flat: { scriptsDir: ".tool/hooks/" } })).hookScript,
    ]).toStrictEqual([undefined, undefined, undefined]);
  });
});

describe("a flat build's hooks artifact", () => {
  it("puts each plugin's scripts in a folder of its own, and its hooks file beside them", () => {
    const artifact = supported(
      flatHooksArtifact(routed({ flat: { scriptsDir: ".tool/hooks/" } }), { tool: "cursor" })
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
        routed({
          file: FLAT_FILE,
          eventMap: { Start: ["start"] },
          undeclaredEvents: "skipped",
          flat: { scriptsDir: ".tool/hooks/", sharedFile: ".tool/hooks.json" },
        }),
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
        routed({
          rootToken: ROOT,
          file: FLAT_FILE,
          flat: { scriptsDir: ".tool/hooks/", sharedFile: ".tool/hooks.json" },
        }),
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
      flatHooksArtifact(routed({ file: FLAT_FILE, flat: { scriptsDir: ".tool/hooks/" } }), {
        tool: "cursor",
      })
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

  it("merges through a tool's own merge where no file format describes its hooks file", () => {
    const ownMerge = (existing: string | null, pluginHooks: string, plugin: string) => ({
      content: `${existing ?? ""}+${pluginHooks}@${plugin}`,
      warnings: [],
    });
    const artifact = supported(
      flatHooksArtifact(
        routed({ flat: { scriptsDir: ".tool/hooks/", sharedFile: ".tool/hooks.json" } }),
        { tool: "cursor" },
        ownMerge
      )
    );

    expect([artifact.hooksFile?.path("p"), artifact.hooksFile?.shared]).toStrictEqual([
      ".tool/hooks.json",
      true,
    ]);
    expect(artifact.hooksFile?.merge(null, "h", "p", locate).content).toBe("+h@p");
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
        flatHooksArtifact(routed({ flat: { scriptsDir: ".tool/hooks/" } }), { tool: "cursor" })
      ).hooksFile
    ).toBeUndefined();
  });

  it("delivers a loader's own module beside the loader, and every other script per plugin", () => {
    const artifact = supported(
      flatHooksArtifact(routed({ flat: { scriptsDir: ".tool/hooks/", loaderEntry: LOADER } }), {
        tool: "cursor",
      })
    );

    expect(artifact.path("aidd-dev", "hooks/tool-plugin.js")).toBe(".tool/plugin/aidd-dev.js");
    expect(artifact.path("aidd-dev", "hooks/journal.cjs")).toBe(".tool/hooks/aidd-dev/journal.cjs");
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
        tool: "cursor",
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

describe("the hooks file the framework install writes", () => {
  it("is read from the descriptor's own parameters", () => {
    const capability = hooksConfigPart({
      config: {
        outputPath: ".tool/hooks.json",
        mergeStrategy: "none",
        consumes: ["tool-hooks"],
      },
    });

    expect(capability.outputPath()).toBe(".tool/hooks.json");
    expect(capability.mergeStrategy()).toBe("none");
    expect(capability.consumes("tool-hooks")).toBe(true);
  });
});

describe("where a plugin's bridge lands", () => {
  it("beside the loader's own module, named after the plugin", () => {
    expect(hooksBridgePath(LOADER, "aidd-dev")).toBe(".tool/plugin/aidd-dev-hooks.js");
  });
});

describe("a tool's plugins capability, as far as hooks go", () => {
  it("accepts hooks natively, with the root token and trust notice the descriptor names", () => {
    expect(
      nativeHooksSupport(routed({ rootToken: "$ROOT", trustNotice: "trust it" }))
    ).toStrictEqual({
      delivery: { kind: "plugin-file", trustNotice: "trust it" },
      rootToken: "$ROOT",
    });
  });

  it("refuses a native tool whose descriptor names no plugin root token", () => {
    expect(() => nativeHooksSupport(routed({}))).toThrow(CapabilityConfigError);
  });

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

  it("merges an installed plugin's hooks into the project file the route names", () => {
    const support = projectHooksSupport(
      routed({
        rootToken: ROOT,
        file: FLAT_FILE,
        eventMap: { Start: ["start"] },
        undeclaredEvents: "skipped",
        project: {
          pluginFile: "hooks.json",
          sharedFile: ".tool/hooks.json",
          scriptsDir: ".tool/hooks/",
        },
      })
    );
    const { merge, unmerge, contributedEntries, isEmpty, scriptPath, scriptDir } =
      support.project.format;
    const merged = merge(null, SHIPPED, "p").content;

    expect([support.kind, support.pluginFile, support.project.relativePath]).toStrictEqual([
      "project-merge",
      "hooks.json",
      ".tool/hooks.json",
    ]);
    expect(JSON.parse(merged)).toStrictEqual({
      version: 1,
      hooks: { start: [{ command: "node ./.tool/hooks/p/a.cjs skills/s" }] },
    });
    expect(JSON.parse(unmerge(merged, "p"))).toStrictEqual({ version: 1 });
    expect(contributedEntries(merged, "p")).toStrictEqual([
      { event: "start", entry: { command: "node ./.tool/hooks/p/a.cjs skills/s" } },
    ]);
    expect(contributedEntries(merged, "q")).toStrictEqual([]);
    expect([isEmpty(merged), isEmpty(unmerge(merged, "p"))]).toStrictEqual([false, true]);
    expect(scriptPath("p", "hooks/lib/a.cjs")).toBe(".tool/hooks/p/lib/a.cjs");
    expect(scriptDir("p")).toBe(".tool/hooks/p/");
    expect(
      [
        "node ./.tool/hooks/p/a.cjs",
        "node ./x/.tool/hooks/p/a.cjs",
        `node ${ROOT}/.tool/hooks/p/a.cjs`,
        // biome-ignore lint/suspicious/noTemplateCurlyInString: a person's own shell variable
        "node ${HOME}/.tool/hooks/p/a.cjs",
      ].map(
        (command) =>
          contributedEntries(JSON.stringify({ hooks: { start: [{ command }] } }), "p").length
      )
    ).toStrictEqual([1, 0, 1, 0]);
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
