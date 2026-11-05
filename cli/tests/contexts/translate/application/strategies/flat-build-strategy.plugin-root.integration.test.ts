import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import "../../../../../src/runtime/wiring/translate.js";
import {
  buildContractFor,
  getAllRegisteredTools,
} from "../../../../../src/contexts/tools/domain/registry.js";
import { FlatBuildStrategy } from "../../../../../src/contexts/translate/application/strategies/flat-build-strategy.js";
import { McpConfigError } from "../../../../../src/kernel/errors.js";
import type { AssetProvider } from "../../../../../src/kernel/ports/asset-provider.js";
import type { ToolId } from "../../../../../src/kernel/tool.js";
import { InMemoryFileAdapter } from "../../../../helpers/ports/in-memory-file-adapter.js";

// resolve(), not the bare literal: on Windows a leading "/" is drive-relative.
const OUT = resolve("/tmp/aidd-flat-plugin-root");
const SOURCE = resolve("/src");
const PLUGIN_SRC = `${SOURCE}/plugins/plug`;
const PLUGIN = "plug";
// Avoid biome noTemplateCurlyInString
const ROOT_TOKEN = "CLAUDE_PLUGIN_ROOT";
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";

const ASSETS: AssetProvider = {
  loadConfigAsset: (_tool, name) =>
    name.endsWith(".js") ? "export async function setupOpencodeEvents() {}" : "{}",
  loadSchema: () => ({}),
};

function flatTools(): ToolId[] {
  return [...getAllRegisteredTools().keys()]
    .filter((id) => buildContractFor(id, "flat") !== undefined)
    .sort();
}

/** A plugin whose MCP server and hook name `paths`, each under the plugin root. */
function seeded(paths: readonly string[]): InMemoryFileAdapter {
  const fs = new InMemoryFileAdapter({
    [`${PLUGIN_SRC}/agents/reviewer.md`]: "---\nname: reviewer\ndescription: Reads\n---\nBody.\n",
    [`${PLUGIN_SRC}/skills/plan/SKILL.md`]: "---\nname: plan\ndescription: Plans\n---\nBody.\n",
    [`${PLUGIN_SRC}/hooks/server.js`]: "console.log('up');\n",
    [`${PLUGIN_SRC}/hooks/hooks.json`]: JSON.stringify({
      hooks: {
        SessionStart: [
          { hooks: paths.map((path) => ({ type: "command", command: `node ${ROOT}/${path}` })) },
        ],
      },
    }),
    [`${PLUGIN_SRC}/.mcp.json`]: JSON.stringify({
      mcpServers: { serve: { command: "node", args: paths.map((path) => `${ROOT}/${path}`) } },
    }),
    [`${PLUGIN_SRC}/scripts/x.js`]: "console.log('x');\n",
  });
  fs.setFile(`${OUT}/.keep`, "");
  return fs;
}

async function build(tool: ToolId, fs: InMemoryFileAdapter): Promise<void> {
  const contract = buildContractFor(tool, "flat");
  if (contract === undefined) throw new Error(`${tool} has no flat contract`);
  const strategy = new FlatBuildStrategy(fs, ASSETS, contract(), false, OUT, async () => true);
  await strategy.preBuild(OUT, SOURCE);
  await strategy.writeAgents(PLUGIN, PLUGIN_SRC);
  await strategy.writeSkills(PLUGIN, PLUGIN_SRC);
  await strategy.writeHooks(PLUGIN, PLUGIN_SRC);
  await strategy.writeMcp(PLUGIN, PLUGIN_SRC);
  await strategy.postBuild({ name: "m", plugins: [] }, [{ name: PLUGIN }], OUT);
}

function written(fs: InMemoryFileAdapter): Map<string, string> {
  const prefix = `${OUT.replace(/\\/g, "/")}/`;
  return new Map(
    fs.listUnder(OUT).map((path) => {
      const rel = path.replace(/\\/g, "/").slice(prefix.length);
      return [rel, fs.getFile(path) ?? ""];
    })
  );
}

describe("a flat build resolves every plugin-root reference to a file it writes", () => {
  it.each(flatTools())("leaves no plugin-root token in any file written for %s", async (tool) => {
    const fs = seeded(["hooks/server.js", "agents/reviewer.md", "skills/plan/SKILL.md"]);

    await build(tool, fs);

    const files = written(fs);
    const leaking = [...files].filter(([, content]) => content.includes(ROOT_TOKEN));
    expect(leaking.map(([path]) => path)).toEqual([]);
  });

  it.each(flatTools())("points %s's MCP server at the hook script it wrote", async (tool) => {
    const fs = seeded(["hooks/server.js"]);

    await build(tool, fs);

    const files = written(fs);
    const script = [...files.keys()].find((path) => path.endsWith("/server.js"));
    expect(script, "the hook script is written").toBeDefined();
    const absolute = `${OUT.replace(/\\/g, "/")}/${script}`;
    const naming = [...files].filter(([, content]) => content.includes(absolute));
    expect(naming.length, `a config names ${absolute}`).toBeGreaterThan(0);
  });
});

describe("a flat build that folds MCP servers into the tool's own config", () => {
  it.each(["codex", "kilo", "opencode"] as const)(
    "names the plugin whose MCP config %s cannot parse",
    async (tool) => {
      const fs = seeded(["hooks/server.js"]);
      fs.setFile(`${PLUGIN_SRC}/.mcp.json`, "{ not json");

      const failure = await build(tool, fs).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(McpConfigError);
      expect((failure as Error).message).toContain("'plug'");
    }
  );
});
