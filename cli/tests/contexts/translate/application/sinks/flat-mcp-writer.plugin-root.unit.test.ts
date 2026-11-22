import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "../../../../../src/presentation/errors/error-translator.presenter.js";
import "../../../../../src/composition/translate.js";
import { McpConfigError } from "../../../../../src/shared/domain/shared.error.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import type { AssetProvider } from "../../../../../src/shared/ports/asset-provider.js";
import {
  buildContractOf,
  declaredBuildContract,
} from "../../../../shared/testing/build-contract-of.builder.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aDiskSink } from "../../testing/disk-sink.builder.js";

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
};

function flatTools(): AiToolId[] {
  return registeredTools()
    .idsInCanonicalOrder("ai")
    .filter((id) => declaredBuildContract(registeredTools(), id, "flat") !== null)
    .sort();
}

/** The flat tools that take a plugin's MCP servers. */
function mcpTools(): AiToolId[] {
  return flatTools().filter(
    (id) => declaredBuildContract(registeredTools(), id, "flat")?.artifacts.mcp.supported
  );
}

/** A plugin whose MCP server and hook name `paths`, each under the plugin root. */
function seeded(paths: readonly string[]): InMemoryFileAdapter {
  const fs = new InMemoryFileAdapter({
    [`${PLUGIN_SRC}/.claude-plugin/plugin.json`]: "{}",
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

async function build(tool: AiToolId, fs: InMemoryFileAdapter): Promise<void> {
  const contract = buildContractOf(registeredTools(), tool, "flat");
  const sink = aDiskSink(fs, { validate() {} }, ASSETS, new CapturingLogger());
  const target = { contract, mode: "flat", force: false, sourceDir: SOURCE, outDir: OUT } as const;
  await sink.prepare(target);
  const { declaredMcp } = await sink.writePlugin(target, PLUGIN, PLUGIN_SRC);
  await sink.finish(target, { name: "m", plugins: [] }, [{ name: PLUGIN, declaredMcp }]);
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

  it.each(mcpTools())("points %s's MCP server at the hook script it wrote", async (tool) => {
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
  it.each([TOOL.codex, TOOL.kilo, TOOL.opencode] as const)(
    "names the plugin whose MCP config %s cannot parse",
    async (tool) => {
      const fs = seeded(["hooks/server.js"]);
      fs.setFile(`${PLUGIN_SRC}/.mcp.json`, "{ not json");

      const failure = await build(tool, fs).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(McpConfigError);
      expect(render(failure)).toContain("'plug'");
    }
  );
});
