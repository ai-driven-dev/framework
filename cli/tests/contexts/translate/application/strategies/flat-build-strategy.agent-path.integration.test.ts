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
const AGENT_REFERENCE = `${ROOT}/agents/reviewer.md`;

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

function seeded(): InMemoryFileAdapter {
  const fs = new InMemoryFileAdapter({
    [`${PLUGIN_SRC}/agents/reviewer.md`]: "---\nname: reviewer\ndescription: Reads\n---\nBody.\n",
    [`${PLUGIN_SRC}/hooks/hooks.json`]: JSON.stringify({
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: `node ${AGENT_REFERENCE}` }] }],
      },
    }),
    [`${PLUGIN_SRC}/.mcp.json`]: JSON.stringify({
      mcpServers: { review: { command: "node", args: [AGENT_REFERENCE] } },
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

async function build(tool: ToolId) {
  const fs = seeded();
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
    expect(flatTools()).toEqual(["claude", "codex", "copilot", "cursor", "kilo", "opencode"]);
  });

  it.each(flatTools())("on %s", async (tool) => {
    const { agents, references } = await build(tool);

    expect(agents, "the agents build writes one file").toHaveLength(1);
    const written = agents[0] as string;
    for (const reference of references) {
      expect(reference.endsWith(`/${written}`), `${reference} names ${written}`).toBe(true);
    }
    // Kilo and OpenCode read no rewritten hooks.json and take MCP through their own config
    // step, so neither has a rewritten reference to check.
    const rewrites = !["kilo", "opencode"].includes(tool);
    expect(references.length > 0, "a rewritten reference exists").toBe(rewrites);
  });
});
