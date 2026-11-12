import type { AiTool, IdeToolConfig } from "../../../../src/contexts/tools/domain/contracts.js";
import { PluginContentTranslator } from "../../../../src/contexts/translate/domain/content-translator.js";
import {
  type PluginComponentFile,
  type PluginComponents,
  PluginDistribution,
} from "../../../../src/contexts/translate/domain/plugin-distribution.js";
import { FileHash } from "../../../../src/kernel/file.js";

export const stubHasher = { hash: (_content: string) => new FileHash("a".repeat(32)) };
export const translator = new PluginContentTranslator(stubHasher);

export const greetContent = `---
name: aidd:04:greet
description: Greet command
---

Greet from sample-plugin.
`;

export const skillContent = `---
name: hello
description: Hello skill
---

Hello from sample-plugin skill.
`;

export const agentContent = `---
name: reviewer
description: Reviewer agent
---

Reviewer agent from sample-plugin.
`;

export const ruleContent = `---
description: Coding standards rule
paths:
  - "**/*.ts"
---

Use strict types.
`;

export const hooksJsonContent = `{ "hooks": [] }`;
export const mcpJsonContent = `{ "mcpServers": {} }`;
export const claudeManifestContent = `{ "name": "sample-plugin", "version": "1.0.0" }`;

export function makeFile(relativePath: string, content: string): PluginComponentFile {
  return { relativePath, content };
}

export function makeDist(
  overrides: Partial<ConstructorParameters<typeof PluginDistribution>[0]> = {}
): PluginDistribution {
  const commands = [makeFile("commands/greet.md", greetContent)];
  const skills = [makeFile("skills/hello/SKILL.md", skillContent)];
  const agents = [makeFile("agents/reviewer.md", agentContent)];
  const rules = [makeFile("rules/standards.md", ruleContent)];
  const hooks = [makeFile("hooks/hooks.json", hooksJsonContent)];
  const mcp = [makeFile(".mcp.json", mcpJsonContent)];
  const manifest = makeFile(".claude-plugin/plugin.json", claudeManifestContent);
  return new PluginDistribution({
    manifest: { name: "sample-plugin", version: "1.0.0" },
    format: "claude",
    files: [...skills, ...commands, ...agents, ...rules, ...hooks, ...mcp, manifest],
    components: { skills, commands, agents, rules, hooks, mcp },
    ...overrides,
  });
}

export function pathsFor(tool: AiTool | IdeToolConfig, dist = makeDist()): string[] {
  return translator.translate(dist, tool).map((f) => f.relativePath);
}

export const CLAUDE_ROOT_TOKEN = "$" + "{CLAUDE_PLUGIN_ROOT}";
export const CODEX_ROOT_TOKEN = "$" + "{PLUGIN_ROOT}";

export const skillEntryContent = `---
name: hello
description: Hello skill
---

Hello body.
`;

export const skillActionContent = `---
name: run
description: Run action
---

Run body.
`;

export const skillAssetContent = `{ "entry": "${CLAUDE_ROOT_TOKEN}/skills/hello/run.sh" }\n`;
export const hookScriptContent = `#!/bin/sh\nexec "${CLAUDE_ROOT_TOKEN}/hooks/lib/check.sh"\n`;

export function hooksManifestFor(token: string): string {
  return JSON.stringify({
    hooks: {
      PreToolUse: [
        { matcher: "Bash", hooks: [{ type: "command", command: `${token}/hooks/check.sh` }] },
      ],
    },
  });
}

export function distOf(files: PluginComponentFile[], components: Partial<PluginComponents>) {
  return new PluginDistribution({
    manifest: { name: "sample-plugin", version: "1.0.0" },
    format: "claude",
    files: [...files, makeFile(".claude-plugin/plugin.json", claudeManifestContent)],
    components: {
      skills: [],
      commands: [],
      agents: [],
      rules: [],
      hooks: [],
      mcp: [],
      ...components,
    },
  });
}

export function skillDist(): PluginDistribution {
  const skills = [
    makeFile("skills/hello/SKILL.md", skillEntryContent),
    makeFile("skills/hello/actions/run.md", skillActionContent),
    makeFile("skills/hello/reference.json", skillAssetContent),
  ];
  return distOf([...skills], { skills });
}

export function hooksDist(extra: PluginComponentFile[] = []): PluginDistribution {
  const hooks = [
    makeFile("hooks/hooks.json", hooksManifestFor(CLAUDE_ROOT_TOKEN)),
    makeFile("hooks/lib/check.sh", hookScriptContent),
    ...extra,
  ];
  return distOf([...hooks], { hooks });
}

export function treeOf(
  tool: AiTool | IdeToolConfig,
  dist: PluginDistribution
): Record<string, string> {
  return Object.fromEntries(
    translator.translate(dist, tool).map((f) => [f.relativePath, f.content])
  );
}

export function installedPathsOf(tool: AiTool | IdeToolConfig, dist: PluginDistribution): string[] {
  return Object.keys(treeOf(tool, dist)).sort();
}
