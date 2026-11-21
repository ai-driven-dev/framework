import { basename, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ArtifactContract,
  ConfigArtifactInput,
  ToolBuildContract,
} from "../../../../../src/contexts/tools/contract/build-contract.js";
import type { BuildNativeTree } from "../../../../../src/contexts/translate/application/build-native-tree.js";
import {
  FlatTargetExistsError,
  FrameworkPlaceholderInPluginError,
  JsonSchemaValidationError,
  OutDirNotDirectoryError,
} from "../../../../../src/contexts/translate/domain/translate.error.js";
import type { JsonSchemaValidator } from "../../../../../src/contexts/translate/ports/json-schema-validator.js";
import type { AssetProvider } from "../../../../../src/shared/ports/asset-provider.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { buildContractOf } from "../../../../shared/testing/registered-build-contracts.builder.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../../shared/testing/seed-from-directory.builder.js";
import { buildTree } from "../../testing/build-tree.builder.js";
import { aDiskSink } from "../../testing/disk-sink.builder.js";

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/framework");
// resolve(): on Windows a leading "/" gets the current drive, as production's resolve(outDir) does.
const ABS_OUT = resolve("/tmp/aidd-flat-test");
const PLUGIN = "aidd-test";

const MINIMAL_MANIFEST_SCHEMA = {
  type: "object",
  required: ["name"],
  properties: { name: { type: "string" } },
};

const MINIMAL_MARKETPLACE_SCHEMA = {
  type: "object",
  required: ["name", "metadata", "owner", "plugins"],
  properties: {
    name: { type: "string" },
    metadata: { type: "object" },
    owner: { type: "object" },
    plugins: { type: "array" },
  },
};

function makeValidator(fail = false): JsonSchemaValidator {
  return {
    validate(_schema: object, _data: unknown): void {
      if (fail) throw new JsonSchemaValidationError(["schema validation failed"]);
    },
  };
}

function makeAssetProvider(): AssetProvider {
  return {
    loadConfigAsset: (_toolId, fileName) => {
      if (fileName === "opencode-events.js") {
        return "export async function setupOpencodeEvents() {}";
      }
      if (fileName === "opencode.json") {
        return {
          $schema: "https://opencode.ai/config.json",
          instructions: [".opencode/rules/**/*.md"],
        };
      }
      throw new Error("not used");
    },
    loadSchema: (name) => {
      if (name === "plugin-manifest") return MINIMAL_MANIFEST_SCHEMA;
      if (name === "marketplace") return MINIMAL_MARKETPLACE_SCHEMA;
      return {};
    },
  };
}

async function makeSeededFs(): Promise<InMemoryFileAdapter> {
  const memFs = new InMemoryFileAdapter();
  await seedFromDirectory(memFs, FIXTURE_DIR, { useAbsolutePaths: true });
  memFs.setFile(`${ABS_OUT}/.keep`, "");
  return memFs;
}

function makeUseCase(
  memFs: InMemoryFileAdapter,
  force = false,
  validator?: JsonSchemaValidator
): BuildNativeTree {
  const v = validator ?? makeValidator();
  const ap = makeAssetProvider();
  return buildTree(
    memFs,
    v,
    ap,
    new CapturingLogger(),
    buildContractOf(TOOL.copilot, "flat"),
    "flat",
    force
  );
}

describe("FlatOutputStrategy integration", () => {
  let memFs: InMemoryFileAdapter;

  beforeEach(async () => {
    memFs = await makeSeededFs();
  });

  describe("collision detection without --force", () => {
    it("halts with FlatTargetExistsError when agent file already exists", async () => {
      const useCase1 = makeUseCase(memFs, false);
      await useCase1.execute({ sourceDir: FIXTURE_DIR, outDir: ABS_OUT, target: TOOL.copilot });

      const useCase2 = makeUseCase(memFs, false);
      await expect(
        useCase2.execute({ sourceDir: FIXTURE_DIR, outDir: ABS_OUT, target: TOOL.copilot })
      ).rejects.toBeInstanceOf(FlatTargetExistsError);
    });
  });

  describe("safety guards", () => {
    it("throws OutDirNotDirectoryError when outDir does not exist", async () => {
      const emptyFs = new InMemoryFileAdapter();
      await seedFromDirectory(emptyFs, FIXTURE_DIR, { useAbsolutePaths: true });
      const v = makeValidator();
      const ap = makeAssetProvider();
      const useCase = buildTree(
        emptyFs,
        v,
        ap,
        new CapturingLogger(),
        buildContractOf(TOOL.copilot, "flat"),
        "flat"
      );
      await expect(
        useCase.execute({ sourceDir: FIXTURE_DIR, outDir: "/nonexistent", target: TOOL.copilot })
      ).rejects.toBeInstanceOf(OutDirNotDirectoryError);
    });

    it("throws OutDirNotDirectoryError when outDir is a file, not a directory", async () => {
      const fileFs = new InMemoryFileAdapter();
      await seedFromDirectory(fileFs, FIXTURE_DIR, { useAbsolutePaths: true });
      fileFs.setFile(ABS_OUT, "I am a file, not a directory");
      const v2 = makeValidator();
      const ap2 = makeAssetProvider();
      const useCase = buildTree(
        fileFs,
        v2,
        ap2,
        new CapturingLogger(),
        buildContractOf(TOOL.copilot, "flat"),
        "flat"
      );
      await expect(
        useCase.execute({ sourceDir: FIXTURE_DIR, outDir: ABS_OUT, target: TOOL.copilot })
      ).rejects.toBeInstanceOf(OutDirNotDirectoryError);
    });
  });

  describe("invalid manifest", () => {
    it("throws JsonSchemaValidationError for invalid plugin.json (orchestrator-side)", async () => {
      const useCase = makeUseCase(memFs, false, makeValidator(true));
      await expect(
        useCase.execute({ sourceDir: FIXTURE_DIR, outDir: ABS_OUT, target: TOOL.copilot })
      ).rejects.toBeInstanceOf(JsonSchemaValidationError);
    });
  });

  describe("MCP key collision detection", () => {
    it("throws FlatTargetExistsError when two writeMcp calls produce the same prefixed key", async () => {
      const pluginSrc = `${FIXTURE_DIR}/plugins/${PLUGIN}`;
      const mcpOnly = new InMemoryFileAdapter({
        [`${pluginSrc}/.claude-plugin/plugin.json`]: "{}",
        [`${pluginSrc}/.mcp.json`]: memFs.getFile(`${pluginSrc}/.mcp.json`) ?? "",
      });
      const sink = aDiskSink(mcpOnly, makeValidator(), makeAssetProvider(), new CapturingLogger());
      const target = {
        contract: buildContractOf(TOOL.copilot, "flat"),
        mode: "flat",
        force: false,
        sourceDir: FIXTURE_DIR,
        outDir: ABS_OUT,
      } as const;
      await sink.writePlugin(target, PLUGIN, pluginSrc);
      await expect(sink.writePlugin(target, PLUGIN, pluginSrc)).rejects.toBeInstanceOf(
        FlatTargetExistsError
      );
    });
  });

  describe("AC #11: unsupported hooks warn-and-skip", () => {
    it("warns and skips hooks for a hooks-bearing plugin when hooks is unsupported", async () => {
      const captLogger = new CapturingLogger();
      // No shipped flat contract declares hooks unsupported any more, so this exercises
      // writeHooks's own unsupported branch on a contract built for that case.
      const base = buildContractOf(TOOL.opencode, "flat");
      const useCase = buildTree(
        memFs,
        makeValidator(),
        makeAssetProvider(),
        captLogger,
        { ...base, artifacts: { ...base.artifacts, hooks: { supported: false } } },
        "flat"
      );
      memFs.setFile(`${FIXTURE_DIR}/plugins/${PLUGIN}/hooks/hooks.json`, '{"hooks":{}}');
      await useCase.execute({ sourceDir: FIXTURE_DIR, outDir: ABS_OUT, target: TOOL.opencode });
      expect(captLogger.warnMessages.some((m) => m.includes("hooks"))).toBe(true);
      const hooksFiles = memFs
        .listAll()
        .filter((p) => p.startsWith(ABS_OUT) && p.includes("hooks"));
      expect(hooksFiles).toHaveLength(0);
    });
  });
});

/** A layout stated in the test itself: the shipped contracts cover no artifact that declares
 * no transform, no extension and no merge, and those are the branches a flat build turns on. */
// Posix on every platform: the adapter keys writes that way and expectations concatenate on it.
const STUB_OUT = resolve("/tmp/aidd-flat-stub-test").replaceAll("\\", "/");
const STUB_PLUGIN_SRC = "/src/plugins/aidd-test";

function supportedArtifact(
  path: (plugin: string, relPath: string) => string,
  extra: Partial<Extract<ArtifactContract, { supported: true }>> = {}
): ArtifactContract {
  return {
    supported: true,
    source: { kind: "fullTree", srcDir: "." },
    path,
    ...extra,
  };
}

function stubContract(over: Partial<ToolBuildContract> = {}): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      agents: supportedArtifact((plugin, rel) => `.stub/agents/${plugin}-${rel.slice(7)}`),
      skills: supportedArtifact((plugin, rel) => `.stub/skills/${plugin}/${rel.slice(7)}`),
      hooks: supportedArtifact((plugin, rel) => `.stub/hooks/${plugin}/${rel.slice(6)}`),
      mcp: { supported: false },
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    ...over,
  };
}

function stubSink(memFs: InMemoryFileAdapter, logger?: CapturingLogger) {
  return aDiskSink(memFs, makeValidator(), makeAssetProvider(), logger ?? new CapturingLogger());
}

function stubTarget(contract: ToolBuildContract, force = false) {
  return { contract, mode: "flat", force, sourceDir: "/src", outDir: STUB_OUT } as const;
}

/** Builds the stub plugin whole: the source holds one artifact kind, so the count is that kind's. */
async function stubWrite(
  memFs: InMemoryFileAdapter,
  contract: ToolBuildContract,
  logger?: CapturingLogger,
  force = false
): Promise<number> {
  if (!memFs.has(`${STUB_PLUGIN_SRC}/.claude-plugin/plugin.json`)) {
    memFs.setFile(`${STUB_PLUGIN_SRC}/.claude-plugin/plugin.json`, "{}");
  }
  return stubSink(memFs, logger).writePlugin(
    stubTarget(contract, force),
    "aidd-test",
    STUB_PLUGIN_SRC
  );
}

function writtenUnder(memFs: InMemoryFileAdapter, dir: string): Record<string, string | undefined> {
  return Object.fromEntries(memFs.listUnder(dir).map((path) => [path, memFs.getFile(path)]));
}

describe("the agents a flat layout writes", () => {
  const reviewer = "---\nname: reviewer\n---\n\nReview the diff.\n";

  it("writes each agent markdown at the path the layout names, and nothing else under agents/", async () => {
    const memFs = new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/agents/reviewer.md`]: reviewer,
      [`${STUB_PLUGIN_SRC}/agents/notes.txt`]: "not an agent",
    });
    const written = await stubWrite(memFs, stubContract());
    expect(written).toBe(1);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/agents/aidd-test-reviewer.md`]:
        "---\nname: 'reviewer'\n---\n\nReview the diff.\n",
    });
  });

  it("hands the agent to the layout's own transform when it declares one", async () => {
    const memFs = new InMemoryFileAdapter({ [`${STUB_PLUGIN_SRC}/agents/reviewer.md`]: reviewer });
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        agents: supportedArtifact((plugin, rel) => `.stub/agents/${plugin}-${rel.slice(7)}`, {
          transform: (content, plugin, base) => `${plugin}:${base}\n${content}`,
        }),
      },
    });
    await stubWrite(memFs, contract);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/agents/aidd-test-reviewer.md`]: `aidd-test:reviewer.md\n${reviewer}`,
    });
  });

  it("writes nothing for a layout hosting no agent", async () => {
    const memFs = new InMemoryFileAdapter({ [`${STUB_PLUGIN_SRC}/agents/reviewer.md`]: reviewer });
    const contract = stubContract({
      artifacts: { ...stubContract().artifacts, agents: { supported: false } },
    });
    expect(await stubWrite(memFs, contract)).toBe(0);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({});
  });

  it("names the agent that references the framework's tools directory", async () => {
    const memFs = new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/agents/nested/reviewer.md`]: "See @{{TOOLS}}/x.md\n",
    });
    await expect(stubWrite(memFs, stubContract())).rejects.toThrow(
      new FrameworkPlaceholderInPluginError("aidd-test", "agents/nested/reviewer.md")
    );
  });
});

describe("the skills a flat layout writes", () => {
  const entry = "---\nname: hello\n---\n\nHello, see @./reference.json\n";
  const asset = '{ "see": "@./SKILL.md" }\n';

  function skillFs(): InMemoryFileAdapter {
    return new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/skills/hello/SKILL.md`]: entry,
      [`${STUB_PLUGIN_SRC}/skills/hello/reference.json`]: asset,
    });
  }

  it("rewrites a skill markdown's own links and carries every other file as it is", async () => {
    const memFs = skillFs();
    expect(await stubWrite(memFs, stubContract())).toBe(2);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/skills/aidd-test/hello/SKILL.md`]:
        "---\nname: hello\n---\n\nHello, see [reference.json](./reference.json)\n",
      [`${STUB_OUT}/.stub/skills/aidd-test/hello/reference.json`]: asset,
    });
  });

  it("names the entry file after its own folder where the layout asks for it", async () => {
    const memFs = skillFs();
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        skills: supportedArtifact((plugin, rel) => `.stub/skills/${plugin}-${rel.slice(7)}`, {
          rewriteSkillName: true,
        }),
      },
    });
    await stubWrite(memFs, contract);
    expect(memFs.getFile(`${STUB_OUT}/.stub/skills/aidd-test-hello/SKILL.md`)).toBe(
      "---\nname: 'aidd-test-hello'\n---\n\nHello, see [reference.json](./reference.json)\n"
    );
  });

  it("leaves the entry file alone when its flat destination has no folder to name it after", async () => {
    const memFs = skillFs();
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        skills: supportedArtifact((_plugin, rel) => basename(rel), { rewriteSkillName: true }),
      },
    });
    await stubWrite(memFs, contract);
    expect(memFs.getFile(`${STUB_OUT}/SKILL.md`)).toBe(
      "---\nname: hello\n---\n\nHello, see [reference.json](./reference.json)\n"
    );
  });

  it("writes nothing for a layout hosting no skill", async () => {
    const memFs = skillFs();
    const contract = stubContract({
      artifacts: { ...stubContract().artifacts, skills: { supported: false } },
    });
    expect(await stubWrite(memFs, contract)).toBe(0);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({});
  });
});

describe("the hooks a flat layout writes", () => {
  const hooksJson = '{ "hooks": { "PreToolUse": [] } }';

  function hooksFs(): InMemoryFileAdapter {
    return new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/hooks/hooks.json`]: hooksJson,
      [`${STUB_PLUGIN_SRC}/hooks/lib/check.sh`]: "#!/bin/sh\n",
    });
  }

  function fileArtifact(shared: boolean): ArtifactContract {
    return supportedArtifact((plugin, rel) => `.stub/hooks/${plugin}/${rel.slice(6)}`, {
      hooksFile: {
        path: (plugin) => (shared ? ".stub/settings.json" : `.stub/hooks/${plugin}.hooks.json`),
        shared,
        merge: (existing, { json, plugin }) => ({
          content: `${existing ?? "none"}+${plugin}:${json}`,
          warnings: ["one event has no equivalent"],
        }),
      },
    });
  }

  function withHooks(hooks: ArtifactContract): ToolBuildContract {
    return stubContract({ artifacts: { ...stubContract().artifacts, hooks } });
  }

  it("writes the plugin's own hooks file from nothing, and every script beside it", async () => {
    const memFs = hooksFs();
    memFs.setFile(`${STUB_OUT}/.stub/hooks/aidd-test.hooks.json`, "stale");
    expect(await stubWrite(memFs, withHooks(fileArtifact(false)), undefined, true)).toBe(2);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/hooks/aidd-test.hooks.json`]: `none+aidd-test:${hooksJson}`,
      [`${STUB_OUT}/.stub/hooks/aidd-test/lib/check.sh`]: "#!/bin/sh\n",
    });
  });

  it("refuses to overwrite the plugin's own hooks file unless forced", async () => {
    const memFs = hooksFs();
    memFs.setFile(`${STUB_OUT}/.stub/hooks/aidd-test.hooks.json`, "stale");
    await expect(stubWrite(memFs, withHooks(fileArtifact(false)))).rejects.toThrow(
      FlatTargetExistsError
    );
  });

  it("merges into the shared file the layout names, reporting what the merge said", async () => {
    const memFs = hooksFs();
    memFs.setFile(`${STUB_OUT}/.stub/settings.json`, "{}");
    const logger = new CapturingLogger();
    await stubWrite(memFs, withHooks(fileArtifact(true)), logger);
    expect(memFs.getFile(`${STUB_OUT}/.stub/settings.json`)).toBe(`{}+aidd-test:${hooksJson}`);
    expect(logger.warnMessages).toEqual(["one event has no equivalent"]);
  });

  it("merges into a shared file not written yet as into nothing", async () => {
    const memFs = hooksFs();
    await stubWrite(memFs, withHooks(fileArtifact(true)));
    expect(memFs.getFile(`${STUB_OUT}/.stub/settings.json`)).toBe(`none+aidd-test:${hooksJson}`);
  });

  it("writes only the scripts for a layout whose tool reads no hooks file", async () => {
    const memFs = hooksFs();
    expect(await stubWrite(memFs, stubContract())).toBe(1);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/hooks/aidd-test/lib/check.sh`]: "#!/bin/sh\n",
    });
  });

  it("generates the bridge a layout with no manifest of its own declares", async () => {
    const memFs = hooksFs();
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        hooks: supportedArtifact((plugin, rel) => `.stub/hooks/${plugin}/${rel.slice(6)}`, {
          skipHooksJson: true,
          hooksBridge: {
            generate: (raw, plugin) => `bridge(${plugin}):${raw}`,
            path: (plugin) => `.stub/plugin/${plugin}.js`,
            skipIfSourceHas: "own-plugin.js",
          },
        }),
      },
    });
    expect(await stubWrite(memFs, contract)).toBe(2);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/plugin/aidd-test.js`]: `bridge(aidd-test):${hooksJson}`,
      [`${STUB_OUT}/.stub/hooks/aidd-test/lib/check.sh`]: "#!/bin/sh\n",
    });
  });

  it("generates none where the bridge maps nothing the plugin declared", async () => {
    const memFs = hooksFs();
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        hooks: supportedArtifact((plugin, rel) => `.stub/hooks/${plugin}/${rel.slice(6)}`, {
          skipHooksJson: true,
          hooksBridge: {
            generate: () => null,
            path: (plugin) => `.stub/plugin/${plugin}.js`,
            skipIfSourceHas: "own-plugin.js",
          },
        }),
      },
    });
    expect(await stubWrite(memFs, contract)).toBe(1);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({
      [`${STUB_OUT}/.stub/hooks/aidd-test/lib/check.sh`]: "#!/bin/sh\n",
    });
  });

  it("generates no bridge for a plugin shipping its own", async () => {
    const memFs = hooksFs();
    memFs.setFile(`${STUB_PLUGIN_SRC}/hooks/own-plugin.js`, "export const plugin = () => {};\n");
    const contract = stubContract({
      artifacts: {
        ...stubContract().artifacts,
        hooks: supportedArtifact((plugin, rel) => `.stub/hooks/${plugin}/${rel.slice(6)}`, {
          skipHooksJson: true,
          hooksBridge: {
            generate: (raw, plugin) => `bridge(${plugin}):${raw}`,
            path: (plugin) => `.stub/plugin/${plugin}.js`,
            skipIfSourceHas: "own-plugin.js",
          },
        }),
      },
    });
    expect(await stubWrite(memFs, contract)).toBe(2);
    expect(memFs.has(`${STUB_OUT}/.stub/plugin/aidd-test.js`)).toBe(false);
  });

  it("writes nothing for a plugin shipping no hooks manifest", async () => {
    const memFs = new InMemoryFileAdapter({ [`${STUB_PLUGIN_SRC}/README.md`]: "# H" });
    expect(await stubWrite(memFs, stubContract())).toBe(0);
    expect(writtenUnder(memFs, STUB_OUT)).toEqual({});
  });

  it("says once that a layout hosting no hook skips the plugin's own", async () => {
    const memFs = hooksFs();
    const logger = new CapturingLogger();
    const contract = stubContract({
      artifacts: { ...stubContract().artifacts, hooks: { supported: false } },
    });
    expect(await stubWrite(memFs, contract, logger)).toBe(0);
    expect(logger.warnMessages).toEqual([
      "Skipping hooks/ in plugin 'aidd-test' (hooks not supported for this target).",
    ]);
  });
});

describe("what a flat layout writes once every plugin is built", () => {
  it("counts nothing where the layout emits no configuration of its own", async () => {
    const memFs = new InMemoryFileAdapter({});
    expect(
      await stubSink(memFs).finish(stubTarget(stubContract()), { name: "m", plugins: [] }, [])
    ).toBe(0);
  });

  it("hands the layout's own step what it names, then writes what it returns", async () => {
    const memFs = new InMemoryFileAdapter({
      "/src/plugins/aidd-test/.mcp.json": '{"mcpServers":{}}',
      [`${STUB_OUT}/kept.json`]: "kept",
      [`${STUB_OUT}/probed.js`]: "probed",
    });
    const seen: ConfigArtifactInput[] = [];
    const contract = stubContract({
      configArtifact: {
        reads: (names) => ["kept.json", ...names.map((name) => `${name}.absent`)],
        probes: () => ["probed.js", "missing.js"],
        assets: { tool: TOOL.opencode, names: ["opencode-events.js"] },
        emit: (input) => {
          seen.push(input);
          return [
            { path: "one.json", content: "1" },
            { path: "nested/two.json", content: "2" },
          ];
        },
      },
    });
    const sink = stubSink(memFs);
    await sink.prepare(stubTarget(contract));
    const built = [{ name: "aidd-test" }, { name: "aidd-bare" }];
    const reads = vi.spyOn(memFs, "readFile");

    expect(await sink.finish(stubTarget(contract), { name: "m", plugins: [] }, built)).toBe(2);
    expect(seen).toStrictEqual([
      {
        builtPlugins: ["aidd-test", "aidd-bare"],
        pluginMcp: new Map([["aidd-test", '{"mcpServers":{}}']]),
        existing: new Map([["kept.json", "kept"]]),
        present: new Set(["probed.js"]),
        assets: new Map([["opencode-events.js", "export async function setupOpencodeEvents() {}"]]),
      },
    ]);
    expect(memFs.getFile(`${STUB_OUT}/one.json`)).toBe("1");
    expect(memFs.getFile(`${STUB_OUT}/nested/two.json`)).toBe("2");
    expect(reads.mock.calls.map(([path]) => path)).not.toContain(`${STUB_OUT}/probed.js`);
  });
});

describe("where a flat layout points a plugin-root reference", () => {
  const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
  const mcp = (over: Partial<Extract<ArtifactContract, { supported: true }>> = {}) =>
    supportedArtifact((plugin, rel) => rel + plugin, {
      merge: (_existing, prefixed) => ({ mergedContent: JSON.stringify(prefixed), collisions: [] }),
      mergeDest: (out) => `${out}/.stub/mcp.json`,
      ...over,
    });
  const args = [
    `${ROOT}/agents/rev.md`,
    `${ROOT}/skills/hello/x.md`,
    `${ROOT}/hooks/run.sh`,
    `${ROOT}/scripts/other.js`,
  ];

  async function mcpArgs(contract: ToolBuildContract): Promise<string[]> {
    const memFs = new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/.mcp.json`]: JSON.stringify({ mcpServers: { srv: { args } } }),
    });
    await stubWrite(memFs, contract);
    const merged = JSON.parse(memFs.getFile(`${STUB_OUT}/.stub/mcp.json`) ?? "{}") as Record<
      string,
      { args: string[] }
    >;
    return Object.values(merged)[0]?.args ?? [];
  }

  it("resolves a reference under each folder the layout hosts to where the layout writes it", async () => {
    const contract = stubContract({ artifacts: { ...stubContract().artifacts, mcp: mcp() } });
    expect(await mcpArgs(contract)).toEqual([
      `${STUB_OUT}/.stub/agents/aidd-test-rev.md`,
      `${STUB_OUT}/.stub/skills/aidd-test/hello/x.md`,
      `${STUB_OUT}/.stub/hooks/aidd-test/run.sh`,
      `${STUB_OUT}/scripts/other.js`,
    ]);
  });

  it("leaves a reference under a folder the layout does not host where the plugin had it", async () => {
    const off = { supported: false } as const;
    const contract = stubContract({
      artifacts: { ...stubContract().artifacts, mcp: mcp(), agents: off, skills: off, hooks: off },
    });
    expect(await mcpArgs(contract)).toEqual(args.map((a) => a.replace(ROOT, STUB_OUT)));
  });

  const refs = `See @${ROOT}/agents/rev.md and @${ROOT}/skills/other/y.md`;

  it("links a skill to an agent and to another skill where the layout writes them", async () => {
    const memFs = new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/skills/hello/SKILL.md`]: `---\nname: hello\n---\n\n${refs}\n`,
    });
    await stubWrite(memFs, stubContract());
    expect(memFs.getFile(`${STUB_OUT}/.stub/skills/aidd-test/hello/SKILL.md`)).toBe(
      "---\nname: hello\n---\n\nSee [rev.md](../../../agents/aidd-test-rev.md) and [y.md](../other/y.md)\n"
    );
  });

  it("links an agent to itself where the layout writes it, and to an unhosted skill as the plugin had it", async () => {
    const off = { supported: false } as const;
    const memFs = new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/agents/rev.md`]: `---\nname: rev\n---\n\n${refs}\n`,
    });
    await stubWrite(
      memFs,
      stubContract({ artifacts: { ...stubContract().artifacts, skills: off } })
    );
    expect(memFs.getFile(`${STUB_OUT}/.stub/agents/aidd-test-rev.md`)).toBe(
      "---\nname: 'rev'\n---\n\nSee [rev.md](./aidd-test-rev.md) and [y.md](../../skills/other/y.md)\n"
    );
  });

  it("links a skill to an unhosted agent as the plugin had it", async () => {
    const off = { supported: false } as const;
    const memFs = new InMemoryFileAdapter({
      [`${STUB_PLUGIN_SRC}/skills/hello/SKILL.md`]: `---\nname: hello\n---\n\n${refs}\n`,
    });
    await stubWrite(
      memFs,
      stubContract({ artifacts: { ...stubContract().artifacts, agents: off } })
    );
    expect(memFs.getFile(`${STUB_OUT}/.stub/skills/aidd-test/hello/SKILL.md`)).toBe(
      "---\nname: hello\n---\n\nSee [rev.md](../../../../agents/rev.md) and [y.md](../other/y.md)\n"
    );
  });
});
