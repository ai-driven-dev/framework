import {
  type PluginComponentFile,
  PluginDistribution,
} from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../src/shared/domain/plugin/plugin-name.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";

const SKILL = "---\nname: hello\ndescription: Hello skill\n---\n\nHello.\n";
const AGENT = "---\nname: reviewer\ndescription: Reviewer agent\n---\n\nReview.\n";
const COMMAND = "---\nname: aidd:04:greet\ndescription: Greet command\n---\n\nGreet.\n";
const RULE = '---\ndescription: Coding standards\npaths:\n  - "**/*.ts"\n---\n\nBe strict.\n';
const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
const MCP = JSON.stringify({ mcpServers: { reference: { command: "node", args: ["server.js"] } } });

/** The hooks a plugin ships, in the canonical shape, running `command` when a session starts. */
export function referenceHooks(command: string): string {
  return JSON.stringify({
    hooks: { SessionStart: [{ hooks: [{ type: "command", command }] }] },
  });
}

function file(relativePath: string, content: string): PluginComponentFile {
  return { relativePath, content };
}

/** A plugin shipping the six artifacts, named `name`: two plugins of it never share a name. */
export function referencePlugin(name: string): PluginDistribution {
  const skills = [
    file("skills/hello/SKILL.md", SKILL),
    file("skills/other/SKILL.md", SKILL.replace("hello", "other")),
  ];
  const agents = [file("agents/reviewer.md", AGENT)];
  const commands = [file("commands/greet.md", COMMAND)];
  const rules = [file("rules/standards.md", RULE)];
  const hooks = [file("hooks/hooks.json", referenceHooks(`node ${ROOT}/hooks/check.cjs`))];
  const mcp = [file(".mcp.json", MCP)];
  const manifest = file(".claude-plugin/plugin.json", JSON.stringify({ name, version: "1.0.0" }));
  return new PluginDistribution({
    manifest: { name: parsePluginName(name), version: "1.0.0" },
    format: TOOL.claude,
    files: [...skills, ...agents, ...commands, ...rules, ...hooks, ...mcp, manifest],
    components: { skills, agents, commands, rules, hooks, mcp },
  });
}

/** The same plugin with its files and components arriving in the opposite order. */
export function reversed(distribution: PluginDistribution): PluginDistribution {
  const { components } = distribution;
  return new PluginDistribution({
    manifest: distribution.manifest,
    format: distribution.format,
    files: [...distribution.files].reverse(),
    components: {
      skills: [...components.skills].reverse(),
      agents: [...components.agents].reverse(),
      commands: [...components.commands].reverse(),
      rules: [...components.rules].reverse(),
      hooks: [...components.hooks].reverse(),
      mcp: [...components.mcp].reverse(),
    },
  });
}
