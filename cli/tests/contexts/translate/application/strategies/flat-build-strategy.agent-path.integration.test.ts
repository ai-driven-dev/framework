import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../../src/runtime/wiring/translate.js";
import {
  buildContractFor,
  getAllRegisteredTools,
} from "../../../../../src/contexts/tools/domain/registry.js";
import { FlatBuildStrategy } from "../../../../../src/contexts/translate/application/strategies/flat-build-strategy.js";
import type { AssetProvider } from "../../../../../src/kernel/ports/asset-provider.js";
import type { ToolId } from "../../../../../src/kernel/tool.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";

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

function flatTools(): ToolId[] {
  return [...getAllRegisteredTools().keys()]
    .filter((id) => buildContractFor(id, "flat") !== undefined)
    .sort();
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
  const contract = buildContractFor(tool, "flat");
  if (contract === undefined) throw new Error(`${tool} has no flat contract`);
  return new FlatBuildStrategy(fs, ASSETS, contract(), false, OUT, async () => true);
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
  it("covers every flat tool the registry declares", () => {
    expect(flatTools()).toEqual([
      "antigravity",
      "claude",
      "codex",
      "copilot",
      "cursor",
      "kilo",
      "opencode",
    ]);
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
    // Kilo and OpenCode read no rewritten hooks.json and take MCP through their own config
    // step, so neither has a rewritten reference to check. Antigravity takes no MCP and hands
    // each hook command to its wrapper base64-encoded, so no reference reads as text there.
    const rewrites = !["antigravity", "kilo", "opencode"].includes(tool);
    expect(references.length > 0, "a rewritten reference exists").toBe(rewrites);
  });
});
