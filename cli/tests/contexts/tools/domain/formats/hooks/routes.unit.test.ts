import { describe, expect, it } from "vitest";
import {
  flatHooksArtifact,
  flatHooksSupport,
} from "../../../../../../src/contexts/tools/domain/formats/hooks/flat-routes.js";
import {
  hooksConfigPart,
  nativeHooksSupport,
  pluginTreeHooksArtifact,
  projectHooksSupport,
} from "../../../../../../src/contexts/tools/domain/formats/hooks/routes.js";
import { CapabilityConfigError } from "../../../../../../src/contexts/tools/domain/tools.error.js";
import { artifactPath } from "../../../../../../src/shared/domain/materialization/artifact-path.js";
import type { ArtifactContract } from "../../../../../../src/shared/domain/materialization/build-contract.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { routed } from "../../../../../shared/testing/routed-hooks.builder.js";

const SOURCE = { kind: "hooksBundle", jsonPath: "hooks/hooks.json", scriptDir: "hooks" };

function supported(artifact: ArtifactContract): Extract<ArtifactContract, { supported: true }> {
  if (!artifact.supported) throw new Error("expected a supported artifact");
  return artifact;
}

describe("a plugin tree's hooks artifact", () => {
  it("refuses, by its type, a literal object where a declared descriptor is taken", () => {
    // @ts-expect-error only declareHooks yields a descriptor
    expect(() => pluginTreeHooksArtifact({ flat: { scriptsDir: ".tool/hooks/" } })).not.toThrow();
  });

  it("reads the plugin's hooks and keeps every path as authored", () => {
    const artifact = supported(pluginTreeHooksArtifact(routed({})));

    expect(artifact.source).toStrictEqual(SOURCE);
    expect(artifactPath(artifact, "aidd-dev", "hooks/journal.cjs")).toBe("hooks/journal.cjs");
  });
});

// biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a plugin's hooks name
const ROOT = "${CLAUDE_PLUGIN_ROOT}";
const FLAT_FILE = {
  wrapper: { version: 1 },
  entries: { shape: "flat", fieldsKept: ["command"] },
} as const;
const SHIPPED = JSON.stringify({
  hooks: { Start: [{ hooks: [{ command: `node ${ROOT}/hooks/a.cjs ${ROOT}/skills/s` }] }] },
});

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
        tool: TOOL.cursor,
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

describe("the hooks file the framework install writes", () => {
  it("is read from the descriptor's own parameters", () => {
    const capability = hooksConfigPart({
      config: {
        outputPath: ".tool/hooks.json",
        mergeStrategy: "none",
        consumes: ["tool-hooks"],
      },
    });

    expect(capability.fileOf("{}")).toMatchObject({
      relativePath: ".tool/hooks.json",
      mergeStrategy: "none",
    });
    expect(capability.consumes("tool-hooks")).toBe(true);
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
});

describe("what a descriptor refusal says", () => {
  it("names the plugin root token a native tool lacks", () => {
    expect(() => nativeHooksSupport(routed({}))).toThrow(
      expect.objectContaining({
        detail: expect.stringContaining("native mode requires a pluginRootToken."),
      })
    );
  });

  it("carries the trust notice of a project route, and none without one", () => {
    const route = {
      rootToken: ROOT,
      file: FLAT_FILE,
      project: {
        pluginFile: "hooks.json",
        sharedFile: ".tool/hooks.json",
        scriptsDir: ".tool/hooks/",
      },
    };

    expect(projectHooksSupport(routed({ ...route, trustNotice: "trust it" })).trustNotice).toBe(
      "trust it"
    );
    expect(projectHooksSupport(routed(route))).not.toHaveProperty("trustNotice");
  });
});
