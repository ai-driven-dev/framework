import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Manifest } from "../../../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { RemovalClaims } from "../../../../../src/contexts/installation/ports/removal-claims.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../../../src/shared/domain/tool.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { removeProjectPluginOf } from "../../../../shared/testing/remove-project-plugin.builder.js";
import { saying } from "../../../../shared/testing/saying.builder.js";
import { cursorHookScriptDir } from "../../testing/cursor-hook-scripts.builder.js";

const ROOT = "/project";
const MCP_FILE = join(ROOT, "opencode.json");
const tool = registeredTools().aiProfile(TOOL.opencode);

function plugin(options: { scope?: Scope; mcp?: ReadonlyMap<string, string> } = {}) {
  const base = RecordedPlugin.fromJSON({
    name: "aidd-dev",
    source: { kind: "local", path: "/fixture" },
    version: "1.0.0",
    strict: false,
    files: { "skills/a.md": "h1", "skills/b.md": "h2" },
    scope: options.scope ?? "project",
  });
  return options.mcp === undefined ? base : base.withMcpEntries(options.mcp);
}

/** An opencode config holding one server contributed by the plugin, and its recorded digests. */
function contributedConfig() {
  const mcp = tool.flatPluginMcp();
  if (mcp === null) throw new Error("opencode answers a flat mcp file");
  const merged = mcp.mergePluginServers(
    null,
    mcp.transform(JSON.stringify({ mcpServers: { srv: { command: "node", args: ["x"] } } })),
    new Map()
  );
  return { content: merged.mergedContent, entries: merged.contributedEntries };
}

const cursor = registeredTools().aiProfile(TOOL.cursor);
const HOOK_SCRIPT = `${cursorHookScriptDir("aidd-dev")}run.js`;

/** A plugin that copied one hook script, recorded by the digest of its installed bytes. */
function pluginWithHookScript() {
  return plugin().withProjectHooks({
    entries: [],
    scripts: new Map([[HOOK_SCRIPT, FileHash.of("// installed").value]]),
  });
}

class RecordingClaims implements RemovalClaims {
  readonly nativeRefs: ReadonlyMap<ToolId, readonly string[]>[] = [];
  readonly userPlugins: [AiToolId, string, string][] = [];

  async detachNativeRefs(_projectRoot: string, refs: ReadonlyMap<ToolId, readonly string[]>) {
    this.nativeRefs.push(refs);
  }

  async detachUserPlugin(toolId: AiToolId, name: string, projectRoot: string) {
    this.userPlugins.push([toolId, name, projectRoot]);
  }
}

describe("removing a plugin's local integration", () => {
  it("removes the servers the plugin contributed and keeps the ones a person added", async () => {
    const { content, entries } = contributedConfig();
    const fs = new InMemoryFileAdapter();
    const withUserServer = JSON.parse(content);
    withUserServer.mcp.mine = { type: "local", command: ["keep"], enabled: true };
    fs.setFile(MCP_FILE, JSON.stringify(withUserServer));

    await removeProjectPluginOf(fs).removeLocalIntegration({
      tool: tool,
      plugin: plugin({ mcp: entries }),
      projectRoot: ROOT,
      manifest: Manifest.create(),
    });

    const left = JSON.parse(await fs.readFile(MCP_FILE));
    expect(Object.keys(left.mcp)).toEqual(["mine"]);
  });

  it("leaves a missing config file missing", async () => {
    const fs = new InMemoryFileAdapter({}, [ROOT]);
    const { entries } = contributedConfig();

    await removeProjectPluginOf(fs).removeLocalIntegration({
      tool: tool,
      plugin: plugin({ mcp: entries }),
      projectRoot: ROOT,
      manifest: Manifest.create(),
    });

    expect(fs.has(MCP_FILE)).toBe(false);
  });

  it("touches no config when the plugin contributed no server", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(MCP_FILE, "{}");

    await removeProjectPluginOf(fs).removeLocalIntegration({
      tool: tool,
      plugin: plugin(),
      projectRoot: ROOT,
      manifest: Manifest.create(),
    });

    expect(await fs.readFile(MCP_FILE)).toBe("{}");
  });
});

describe("RemoveProjectPlugin.removeLocalIntegration hooks", () => {
  it("deletes the hook script the plugin installed", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, HOOK_SCRIPT), "// installed");

    await removeProjectPluginOf(fs).removeLocalIntegration({
      tool: cursor,
      plugin: pluginWithHookScript(),
      projectRoot: ROOT,
      manifest: Manifest.create(),
    });

    expect(fs.has(join(ROOT, HOOK_SCRIPT))).toBe(false);
  });
});

describe("before removing a plugin's local integration", () => {
  it("refuses a hook script edited since install", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, HOOK_SCRIPT), "// edited");

    await expect(
      removeProjectPluginOf(fs).assertLocalIntegrationRemovable(
        cursor,
        pluginWithHookScript(),
        ROOT
      )
    ).rejects.toThrow(saying("edited after install"));
  });

  it("passes while the contributed servers are as installed", async () => {
    const { content, entries } = contributedConfig();
    const fs = new InMemoryFileAdapter();
    fs.setFile(MCP_FILE, content);

    await expect(
      removeProjectPluginOf(fs).assertLocalIntegrationRemovable(
        tool,
        plugin({ mcp: entries }),
        ROOT
      )
    ).resolves.toBeUndefined();
  });

  it("refuses a contributed server a person edited since, and writes nothing", async () => {
    const { content, entries } = contributedConfig();
    const fs = new InMemoryFileAdapter();
    const edited = JSON.parse(content);
    edited.mcp.srv.command = ["edited"];
    fs.setFile(MCP_FILE, JSON.stringify(edited));

    await expect(
      removeProjectPluginOf(fs).assertLocalIntegrationRemovable(
        tool,
        plugin({ mcp: entries }),
        ROOT
      )
    ).rejects.toThrow();
    expect(JSON.parse(await fs.readFile(MCP_FILE)).mcp.srv.command).toEqual(["edited"]);
  });
});

describe("deleting a plugin's local files", () => {
  it("deletes exactly the files the plugin tracked", async () => {
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, "skills/a.md"), "a");
    fs.setFile(join(ROOT, "skills/b.md"), "b");
    fs.setFile(join(ROOT, "skills/mine.md"), "mine");

    await removeProjectPluginOf(fs).deleteLocalFiles(tool, plugin().plugin, ROOT);

    expect(fs.has(join(ROOT, "skills/a.md"))).toBe(false);
    expect(fs.has(join(ROOT, "skills/b.md"))).toBe(false);
    expect(fs.has(join(ROOT, "skills/mine.md"))).toBe(true);
  });
});

describe("detaching a plugin's claims", () => {
  const refs = new Map<ToolId, readonly string[]>([[TOOL.codex, ["p@c"]]]);

  it("lets go of the native refs and of each removed user-scope plugin only", async () => {
    const claims = new RecordingClaims();

    await removeProjectPluginOf(new InMemoryFileAdapter(), claims).detachClaims(ROOT, refs, [
      { toolId: TOOL.claude, plugin: plugin({ scope: "user" }).plugin },
      { toolId: TOOL.cursor, plugin: plugin({ scope: "project" }).plugin },
    ]);

    expect(claims.nativeRefs).toEqual([refs]);
    expect(claims.userPlugins).toEqual([[TOOL.claude, "aidd-dev", ROOT]]);
  });

  it("holds no claim to let go of when none was supplied", async () => {
    await expect(
      removeProjectPluginOf(new InMemoryFileAdapter()).detachClaims(ROOT, refs, [
        { toolId: TOOL.claude, plugin: plugin({ scope: "user" }).plugin },
      ])
    ).resolves.toBeUndefined();
  });
});
