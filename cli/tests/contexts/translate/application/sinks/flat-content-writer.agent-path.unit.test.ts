import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../../src/composition/translate.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import type { AssetProvider } from "../../../../../src/shared/ports/asset-provider.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  buildContractOf,
  declaredBuildContract,
} from "../../../../shared/testing/registered-build-contracts.builder.js";
import { registeredTools } from "../../../../shared/testing/registered-tools.builder.js";
import { aDiskSink } from "../../testing/disk-sink.builder.js";

// resolve(), not the bare literal: on Windows a leading "/" is drive-relative.
const OUT = resolve("/tmp/aidd-flat-agent-path");
const PLUGIN_SRC = resolve("/src/plugins/plug");
const PLUGIN = "plug";
// Avoid biome noTemplateCurlyInString
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

const ASSETS: AssetProvider = {
  loadConfigAsset: () => {
    throw new Error("not used");
  },
  loadSchema: () => ({}),
};

/** The registered tools that build flat and declare an agents artifact. */
function flatTools(): AiToolId[] {
  return registeredTools()
    .idsInCanonicalOrder("ai")
    .filter((id) => declaredBuildContract(id, "flat")?.artifacts.agents.supported === true);
}

/** Where the plugin keeps its agent: at the top of `agents/`, or in a folder under it. */
const AGENT_FILES = ["reviewer.md", "review/reviewer.md"];

function seeded(agentFile: string, withReferences: boolean): InMemoryFileAdapter {
  const reference = `${ROOT}/agents/${agentFile}`;
  const fs = new InMemoryFileAdapter({
    [`${PLUGIN_SRC}/.claude-plugin/plugin.json`]: "{}",
    [`${PLUGIN_SRC}/agents/${agentFile}`]: "---\nname: reviewer\ndescription: Reads\n---\nBody.\n",
  });
  if (withReferences) {
    fs.setFile(
      `${PLUGIN_SRC}/hooks/hooks.json`,
      JSON.stringify({
        hooks: {
          SessionStart: [{ hooks: [{ type: "command", command: `node ${reference}` }] }],
        },
      })
    );
    fs.setFile(
      `${PLUGIN_SRC}/.mcp.json`,
      JSON.stringify({ mcpServers: { review: { command: "node", args: [reference] } } })
    );
  }
  fs.setFile(`${OUT}/.keep`, "");
  return fs;
}

async function writePlugin(tool: AiToolId, fs: InMemoryFileAdapter): Promise<void> {
  const contract = buildContractOf(tool, "flat");
  const sink = aDiskSink(fs, { validate() {} }, ASSETS, new CapturingLogger());
  const target = {
    contract,
    mode: "flat",
    force: false,
    sourceDir: resolve("/src"),
    outDir: OUT,
  } as const;
  await sink.prepare(target);
  await sink.writePlugin(target, PLUGIN, PLUGIN_SRC);
}

function outRelative(fs: InMemoryFileAdapter): Set<string> {
  const prefix = `${OUT.replace(/\\/g, "/")}/`;
  return new Set(fs.listUnder(OUT).map((p) => p.replace(/\\/g, "/").slice(prefix.length)));
}

function stringsNaming(value: unknown, needle: string): string[] {
  if (typeof value === "string") return value.includes(needle) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((v) => stringsNaming(v, needle));
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap((v) => stringsNaming(v, needle));
  }
  return [];
}

/** Every JSON string the hooks and MCP writes left that names the agent. */
function rewrittenAgentReferences(fs: InMemoryFileAdapter, files: Iterable<string>): string[] {
  const found: string[] = [];
  for (const rel of files) {
    if (!rel.endsWith(".json")) continue;
    const content = fs.getFile(`${OUT}/${rel}`) ?? "";
    found.push(...stringsNaming(JSON.parse(content), "reviewer"));
  }
  return found;
}

async function build(tool: AiToolId, agentFile: string) {
  const agentsOnly = seeded(agentFile, false);
  const before = outRelative(agentsOnly);
  await writePlugin(tool, agentsOnly);
  const afterAgents = outRelative(agentsOnly);
  const agents = [...afterAgents].filter((p) => !before.has(p));
  const fs = seeded(agentFile, true);
  await writePlugin(tool, fs);
  const later = [...outRelative(fs)].filter((p) => !afterAgents.has(p));
  return { agents, references: rewrittenAgentReferences(fs, later) };
}

describe("a hook or MCP command naming an agent lands on the file the agents build writes", () => {
  it("covers more than one flat tool, so the cases below are not a single tool's", () => {
    expect(flatTools().length).toBeGreaterThan(1);
  });

  it.each(
    flatTools().flatMap((tool) => AGENT_FILES.map((agentFile) => [tool, agentFile] as const))
  )("on %s, for agents/%s", async (tool, agentFile) => {
    const { agents, references } = await build(tool, agentFile);

    expect(agents, "the agents build writes one file").toHaveLength(1);
    const [written] = agents;
    if (written === undefined) throw new Error("the agents build wrote nothing");
    for (const reference of references) {
      expect(reference.endsWith(`/${written}`), `${reference} names ${written}`).toBe(true);
    }
  });

  // Kilo, OpenCode and Antigravity leave no reference readable as text (no rewritten hooks.json,
  // MCP through their own config step, hook commands handed over base64-encoded), so the
  // per-tool check above may see none; one tool leaving one keeps it from passing on nothing.
  it("leaves a rewritten reference for at least one flat tool to check", async () => {
    const built = await Promise.all(flatTools().map((tool) => build(tool, "reviewer.md")));

    expect(built.some(({ references }) => references.length > 0)).toBe(true);
  });
});
