import { describe, expect, it } from "vitest";
import { AssertProjectPathWithinRoot } from "../../../../../src/contexts/installation/application/ownership/assert-project-path-within-root.use-case.js";
import { PlanProjectMcpRemoval } from "../../../../../src/contexts/installation/application/removal/plan-project-mcp-removal.use-case.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  contributedOpencodeConfig,
  MCP_FILE,
  MCP_ROOT,
  opencode,
  pluginWithMcp,
} from "../../testing/opencode-mcp-config.builder.js";

function planOver(fs: InMemoryFileAdapter): PlanProjectMcpRemoval {
  return new PlanProjectMcpRemoval(fs, new AssertProjectPathWithinRoot(fs));
}

describe("planning a plugin's MCP servers leaving the project config", () => {
  it("answers the config without the servers the plugin contributed, and writes nothing", async () => {
    const { content, entries } = contributedOpencodeConfig();
    const fs = new InMemoryFileAdapter({ [MCP_FILE]: content }, [MCP_ROOT]);

    const rewrite = await planOver(fs).execute({
      plugin: pluginWithMcp(entries),
      tool: opencode,
      projectRoot: MCP_ROOT,
    });

    expect(rewrite?.output).toBe(MCP_FILE);
    expect(Object.keys(JSON.parse(rewrite?.content ?? "{}").mcp ?? {})).toStrictEqual([]);
    expect(await fs.readFile(MCP_FILE)).toBe(content);
  });

  it("answers nothing when the plugin recorded no server", async () => {
    const fs = new InMemoryFileAdapter({ [MCP_FILE]: "{}" }, [MCP_ROOT]);
    const plugin = RecordedPlugin.fromMetadata({
      name: "aidd-dev",
      version: "1.0.0",
      source: { kind: "local", path: "/fixture" },
      strict: false,
      scope: "project",
    });

    await expect(
      planOver(fs).execute({ plugin, tool: opencode, projectRoot: MCP_ROOT })
    ).resolves.toBeUndefined();
  });

  it("answers nothing when the config file is absent", async () => {
    const { entries } = contributedOpencodeConfig();
    const fs = new InMemoryFileAdapter({}, [MCP_ROOT]);

    await expect(
      planOver(fs).execute({
        plugin: pluginWithMcp(entries),
        tool: opencode,
        projectRoot: MCP_ROOT,
      })
    ).resolves.toBeUndefined();
  });

  it("refuses a config a person edited since the install", async () => {
    const { content, entries } = contributedOpencodeConfig();
    const edited = JSON.parse(content);
    edited.mcp.srv.command = ["edited"];
    const fs = new InMemoryFileAdapter({ [MCP_FILE]: JSON.stringify(edited) }, [MCP_ROOT]);

    await expect(
      planOver(fs).execute({
        plugin: pluginWithMcp(entries),
        tool: opencode,
        projectRoot: MCP_ROOT,
      })
    ).rejects.toThrow();
  });
});
