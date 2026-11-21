import { describe, expect, it, vi } from "vitest";
import type {
  ArtifactContract,
  ConfigArtifactInput,
  ToolBuildContract,
} from "../../../../../src/contexts/tools/contract/build-contract.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import {
  STUB_OUT,
  STUB_PLUGIN_SRC,
  stubContract,
  stubSink,
  stubTarget,
  stubWrite,
  supportedArtifact,
} from "../../testing/flat-writer-world.builder.js";

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
