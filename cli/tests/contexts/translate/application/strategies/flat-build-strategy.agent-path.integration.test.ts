import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../../src/runtime/wiring/translate.js";
import { FlatBuildStrategy } from "../../../../../src/contexts/translate/application/strategies/flat-build-strategy.js";
import type { AssetProvider } from "../../../../../src/kernel/ports/asset-provider.js";
import type { ToolId } from "../../../../../src/kernel/tool.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";
import { registeredCatalog, registeredFlatContract } from "../../../tools/testing/catalog-of.js";

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
function flatTools(): ToolId[] {
  return registeredCatalog()
    .sortedById()
    .map((profile) => profile.toolId)
    .filter((id) => registeredFlatContract(id)?.artifacts.agents.supported === true);
}

/** Where the plugin keeps its agent: at the top of `agents/`, or in a folder under it. */
const AGENT_FILES = ["reviewer.md", "review/reviewer.md"];

function seeded(agentFile: string): InMemoryFileAdapter {
  const reference = `${ROOT}/agents/${agentFile}`;
  const fs = new InMemoryFileAdapter({
    [`${PLUGIN_SRC}/agents/${agentFile}`]: "---\nname: reviewer\ndescription: Reads\n---\nBody.\n",
    [`${PLUGIN_SRC}/hooks/hooks.json`]: JSON.stringify({
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: `node ${reference}` }] }],
      },
    }),
    [`${PLUGIN_SRC}/.mcp.json`]: JSON.stringify({
      mcpServers: { review: { command: "node", args: [reference] } },
    }),
  });
  fs.setFile(`${OUT}/.keep`, "");
  return fs;
}

function strategyFor(tool: ToolId, fs: InMemoryFileAdapter): FlatBuildStrategy {
  const contract = registeredFlatContract(tool);
  if (contract === null) throw new Error(`${tool} has no flat contract`);
  return new FlatBuildStrategy(fs, ASSETS, contract, false, OUT, async () => true);
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

async function build(tool: ToolId, agentFile: string) {
  const fs = seeded(agentFile);
  const strategy = strategyFor(tool, fs);
  await strategy.preBuild(OUT, resolve("/src"));
  const before = outRelative(fs);
  await strategy.writeAgents(PLUGIN, PLUGIN_SRC);
  const agents = [...outRelative(fs)].filter((p) => !before.has(p));
  const afterAgents = outRelative(fs);
  await strategy.writeHooks(PLUGIN, PLUGIN_SRC);
  await strategy.writeMcp(PLUGIN, PLUGIN_SRC);
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
    const written = agents[0] as string;
    for (const reference of references) {
      expect(reference.endsWith(`/${written}`), `${reference} names ${written}`).toBe(true);
    }
  });

  // Kilo, OpenCode and Antigravity leave no reference readable as text (no rewritten hooks.json,
  // MCP through their own config step, hook commands handed over base64-encoded), so the
  // per-tool check above may see none; one tool leaving one keeps it from passing on nothing.
  it("leaves a rewritten reference for at least one flat tool to check", async () => {
    const built = await Promise.all(
      flatTools().map((tool) => build(tool, AGENT_FILES[0] as string))
    );

    expect(built.some(({ references }) => references.length > 0)).toBe(true);
  });
});
