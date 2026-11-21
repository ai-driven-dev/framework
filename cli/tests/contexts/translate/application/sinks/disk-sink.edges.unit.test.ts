import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type {
  ArtifactContract,
  ToolBuildContract,
} from "../../../../../src/contexts/tools/contract/build-contract.js";
import {
  FlatMergeTargetNotJsonError,
  FrameworkPlaceholderInPluginError,
} from "../../../../../src/contexts/translate/domain/translate.error.js";
import type { JsonSchemaValidator } from "../../../../../src/contexts/translate/ports/json-schema-validator.js";
import type { DiskTarget } from "../../../../../src/contexts/translate/ports/plugin-tree-sink.js";
import type { AssetProvider } from "../../../../../src/shared/ports/asset-provider.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { buildContractOf } from "../../../../shared/testing/registered-build-contracts.builder.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { WindowsListingFileAdapter } from "../../../../shared/testing/windows-listing-file-adapter.fake.js";
import { aDiskSink } from "../../testing/disk-sink.builder.js";

// resolve(), not the bare literal: on Windows a leading "/" is drive-relative.
const OUT = resolve("/tmp/aidd-edges-out");
const SOURCE = resolve("/edges-src");
const PLUGIN = "plug";
const PLUGIN_SRC = `${SOURCE}/plugins/${PLUGIN}`;
// Avoid biome noTemplateCurlyInString
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
const FOREIGN_PLACEHOLDER = "@{{TOOLS}}/";

const ASSETS: AssetProvider = {
  loadConfigAsset: () => "{}",
  loadSchema: (name) => {
    if (typeof name !== "string") throw new Error("no schema was asked for");
    return {};
  },
};

const NONE: ArtifactContract = { supported: false };
const COPY: ArtifactContract = {
  supported: true,
  source: { kind: "fullTree", srcDir: "" },
  path: (plugin, rel) => `.out/${plugin}/${rel}`,
};

function contractOf(
  artifacts: Partial<ToolBuildContract["artifacts"]>,
  rest: Partial<ToolBuildContract> = {}
): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: NONE,
      agents: NONE,
      mcp: NONE,
      hooks: NONE,
      rules: NONE,
      commands: NONE,
      ...artifacts,
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    ...rest,
  };
}

function seeded(
  files: Record<string, string> = {},
  Adapter: typeof InMemoryFileAdapter = InMemoryFileAdapter
): InMemoryFileAdapter {
  const fs = new Adapter({
    [`${PLUGIN_SRC}/.claude-plugin/plugin.json`]: "{}",
    ...files,
  });
  return fs;
}

function windowsSeeded(files: Record<string, string>): InMemoryFileAdapter {
  return seeded(files, WindowsListingFileAdapter);
}

function targetOf(
  contract: ToolBuildContract,
  mode: "flat" | "marketplace",
  outDir = OUT
): DiskTarget {
  return { contract, mode, force: false, sourceDir: SOURCE, outDir };
}

async function write(
  fs: InMemoryFileAdapter,
  target: DiskTarget,
  validator: JsonSchemaValidator = { validate() {} },
  logger = new CapturingLogger()
): Promise<number> {
  const sink = aDiskSink(fs, validator, ASSETS, logger);
  if (target.mode === "flat") fs.setFile(`${target.outDir}/.keep`, "");
  await sink.prepare(target);
  const count = await sink.writePlugin(target, PLUGIN, PLUGIN_SRC);
  await sink.finish(target, { name: "m", plugins: [] }, [{ name: PLUGIN }]);
  return count;
}

function writtenPaths(fs: InMemoryFileAdapter): string[] {
  const prefix = `${OUT.replace(/\\/g, "/")}/`;
  return fs
    .listUnder(OUT)
    .map((path) => path.replace(/\\/g, "/").slice(prefix.length))
    .filter((path) => path !== ".keep")
    .sort();
}

describe("a plugin manifest", () => {
  const withManifest = contractOf(
    {},
    { manifestFileRelative: "manifest.json", synthesizeManifest: () => ({ name: PLUGIN }) }
  );

  it("is synthesized into a marketplace tree", async () => {
    const fs = seeded();

    await write(fs, targetOf(withManifest, "marketplace"));

    expect(writtenPaths(fs)).toEqual([`plugins/${PLUGIN}/manifest.json`]);
  });

  it("is not written into a flat tree, which holds no per-plugin manifest", async () => {
    const fs = seeded();

    await write(fs, targetOf(withManifest, "flat"));

    expect(writtenPaths(fs)).toEqual([]);
  });
});

describe("hooks a flat target cannot take", () => {
  const unsupported = contractOf({ hooks: NONE });

  it("are reported when the plugin ships a hooks.json", async () => {
    const logger = new CapturingLogger();

    await write(
      seeded({ [`${PLUGIN_SRC}/hooks/hooks.json`]: "{}" }),
      targetOf(unsupported, "flat"),
      undefined,
      logger
    );

    expect(logger.warnMessages).toEqual([
      `Skipping hooks/ in plugin '${PLUGIN}' (hooks not supported for this target).`,
    ]);
  });

  it("stay silent when the plugin ships none", async () => {
    const logger = new CapturingLogger();

    await write(seeded(), targetOf(unsupported, "flat"), undefined, logger);

    expect(logger.warnMessages).toEqual([]);
  });

  it("stay silent in a marketplace tree, whatever the plugin ships", async () => {
    const logger = new CapturingLogger();

    await write(
      seeded({ [`${PLUGIN_SRC}/hooks/hooks.json`]: "{}" }),
      targetOf(unsupported, "marketplace"),
      undefined,
      logger
    );

    expect(logger.warnMessages).toEqual([]);
  });
});

describe("a flat MCP artifact", () => {
  const merge = () => ({ mergedContent: "{}", collisions: [] });
  const mergeDest = (outDir: string) => `${outDir}/mcp.json`;

  it.each([
    ["names neither a merge nor where it lands", {}],
    ["names a merge but no destination", { merge }],
    ["names a destination but no merge", { mergeDest }],
  ])("writes nothing when it %s", async (_label, parts) => {
    const fs = seeded({ [`${PLUGIN_SRC}/.mcp.json`]: "{ not json" });
    const contract = contractOf({ mcp: { ...COPY, ...parts } });

    const count = await write(fs, targetOf(contract, "flat"));

    expect(count).toBe(0);
    expect(writtenPaths(fs)).toEqual([]);
  });

  it("points its servers at the output, whatever separator the output directory carries", async () => {
    const fs = seeded({
      [`${PLUGIN_SRC}/.mcp.json`]: JSON.stringify({
        mcpServers: { serve: { command: "node", args: [`${ROOT}/hooks/server.js`] } },
      }),
    });
    const contract = contractOf({
      hooks: COPY,
      mcp: {
        ...COPY,
        merge: (_existing, incoming) => ({
          mergedContent: JSON.stringify(incoming),
          collisions: [],
        }),
        mergeDest: (outDir) => `${outDir}/mcp.json`,
      },
    });
    const outDir = `${OUT}\\nested`;

    await write(fs, targetOf(contract, "flat", outDir));

    const written = fs.getFile(`${outDir}/mcp.json`) ?? "";
    expect(written).toContain(`${OUT.replace(/\\/g, "/")}/nested/.out/${PLUGIN}/hooks/server.js`);
  });
});

describe("the marketplace catalog of a tool that names no schema for it", () => {
  it("is written without a validation", async () => {
    const validate = vi.fn();
    const contract = contractOf(
      {},
      {
        buildMarketplaceEntry: async () => ({}),
        buildMarketplaceCatalog: async () => ({
          catalog: { plugins: [] },
          schemaName: null,
          destRelPath: "catalog.json",
        }),
      }
    );
    const fs = seeded();

    await write(fs, targetOf(contract, "marketplace"), { validate });

    expect(fs.getFile(`${OUT}/catalog.json`)).toContain("plugins");
    expect(validate).toHaveBeenCalledTimes(1);
  });
});

describe("a source path a Windows host reports with backslashes", () => {
  it("lands a marketplace hook script under its folder", async () => {
    const fs = windowsSeeded({ [`${PLUGIN_SRC}/hooks/sub/run.js`]: "run" });

    const script = vi.fn((_pluginPath: string, content: string) => content);

    await write(fs, targetOf(contractOf({ hooks: { ...COPY, script } }), "marketplace"));

    expect(writtenPaths(fs)).toEqual([`plugins/${PLUGIN}/hooks/sub/run.js`]);
    expect(script).toHaveBeenCalledWith("hooks/sub/run.js", "run");
  });

  it("lands a flat hook script under its folder", async () => {
    const fs = windowsSeeded({
      [`${PLUGIN_SRC}/hooks/hooks.json`]: "{}",
      [`${PLUGIN_SRC}/hooks/sub/run.js`]: "run",
    });
    const script = vi.fn((_pluginPath: string, content: string) => content);
    const contract = contractOf({ hooks: { ...COPY, skipHooksJson: true, script } });

    await write(fs, targetOf(contract, "flat"));

    expect(writtenPaths(fs)).toEqual([`.out/${PLUGIN}/hooks/sub/run.js`]);
    expect(script).toHaveBeenCalledWith("hooks/sub/run.js", "run");
  });

  it("lands a flat skill file under its folder", async () => {
    const fs = windowsSeeded({ [`${PLUGIN_SRC}/skills/plan/SKILL.md`]: "Plan." });

    const path = vi.fn(COPY.path);

    await write(fs, targetOf(contractOf({ skills: { ...COPY, path } }), "flat"));

    expect(writtenPaths(fs)).toEqual([`.out/${PLUGIN}/skills/plan/SKILL.md`]);
    expect(path).toHaveBeenCalledWith(PLUGIN, "skills/plan/SKILL.md");
  });

  it("names a flat agent with the placeholder by its forward-slash path", async () => {
    const fs = windowsSeeded({ [`${PLUGIN_SRC}/agents/sub/bad.md`]: FOREIGN_PLACEHOLDER });

    const failure = await write(fs, targetOf(contractOf({ agents: COPY }), "flat")).catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(FrameworkPlaceholderInPluginError);
    expect(failure).toMatchObject({ relativePath: "agents/sub/bad.md" });
  });

  it("names a shared hooks file that is not JSON by its forward-slash path", async () => {
    const fs = seeded({ [`${PLUGIN_SRC}/hooks/hooks.json`]: "{}" });
    fs.setFile(`${OUT}/cfg\\hooks.json`, "not json");
    const contract = contractOf({
      hooks: {
        ...COPY,
        hooksFile: {
          path: () => "cfg\\hooks.json",
          shared: true,
          merge: () => ({ content: "{}", warnings: [] }),
        },
      },
    });

    const failure = await write(fs, targetOf(contract, "flat")).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(FlatMergeTargetNotJsonError);
    expect(failure).toMatchObject({ shownPath: "cfg/hooks.json" });
  });
});

describe("the placeholder a plugin must not carry", () => {
  it.each([
    ["a marketplace agent", "agents/bad.md", "marketplace", { agents: COPY }],
    ["a flat skill", "skills/plan/SKILL.md", "flat", { skills: COPY }],
  ] as const)("is refused in %s", async (_label, file, mode, artifacts) => {
    const fs = seeded({ [`${PLUGIN_SRC}/${file}`]: FOREIGN_PLACEHOLDER });

    const failure = await write(fs, targetOf(contractOf(artifacts), mode)).catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(FrameworkPlaceholderInPluginError);
    expect(failure).toMatchObject({ relativePath: file.replace(/^(agents|skills)\//, "") });
  });
});

describe("a flat hooks file that names a script the plugin ships", () => {
  it("points the command at where the script lands", async () => {
    const fs = seeded({ [`${PLUGIN_SRC}/hooks/hooks.json`]: "{}" });
    const contract = contractOf({
      hooks: {
        ...COPY,
        hooksFile: {
          path: () => "hooks-out.json",
          shared: false,
          merge: (_existing, { locate }) => ({
            content: locate?.("hooks/run.js") ?? "",
            warnings: [],
          }),
        },
      },
    });

    await write(fs, targetOf(contract, "flat"));

    expect(fs.getFile(`${OUT}/hooks-out.json`)).toBe(`./.out/${PLUGIN}/hooks/run.js`);
  });
});

describe("a tool's own config built from a plugin's MCP servers", () => {
  it.each([TOOL.codex, TOOL.opencode, TOOL.kilo] as const)(
    "names the hook script %s's server runs by its place in the output",
    async (tool) => {
      const contract = buildContractOf(tool, "flat");
      const fs = seeded({
        [`${PLUGIN_SRC}/hooks/hooks.json`]: "{}",
        [`${PLUGIN_SRC}/hooks/server.js`]: "console.log('up');\n",
        [`${PLUGIN_SRC}/.mcp.json`]: JSON.stringify({
          mcpServers: { serve: { command: "node", args: [`${ROOT}/hooks/server.js`] } },
        }),
      });

      await write(fs, targetOf(contract, "flat"));

      const paths = writtenPaths(fs);
      const script = paths.find((path) => path.endsWith("/server.js"));
      const config = paths.find((path) => path !== script && /config|opencode|kilo/.test(path));
      expect(script, "the hook script is written").toBeDefined();
      expect(config, "the tool writes a config").toBeDefined();
      expect(fs.getFile(`${OUT}/${config}`)).toContain(`${OUT.replace(/\\/g, "/")}/${script}`);
    }
  );
});
