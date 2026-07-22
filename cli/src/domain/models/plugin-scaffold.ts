import type { PluginComponentKind } from "./plugin-component-kind.js";

export const GITKEEP_CONTENT = "";

export function manifestJsonContent(name: string, version: string, description: string): string {
  const manifest = {
    $schema: "https://json.schemastore.org/claude-code-plugin-manifest.json",
    name,
    version,
    description,
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function readmeContent(name: string, description: string): string {
  return `# ${name}\n\n${description}\n`;
}

export function changelogContent(): string {
  return `# Changelog\n\n## [0.1.0]\n\n- Initial scaffold.\n`;
}

export function skillContent(skillName: string): string {
  return `---\nname: ${skillName}\ndescription: TODO\n---\n\n# ${skillName}\n\n## Goal\n\nTODO\n`;
}

export function agentContent(agentName: string): string {
  return `---\nname: ${agentName}\ndescription: TODO\n---\n\n# ${agentName}\n\n## Goal\n\nTODO\n`;
}

export function hooksJsonContent(): string {
  return `${JSON.stringify({ hooks: {} }, null, 2)}\n`;
}

export function mcpJsonContent(): string {
  return `${JSON.stringify({ mcpServers: {} }, null, 2)}\n`;
}

export function scenariosJsonContent(): string {
  const content = { scenarios: [] as unknown[] };
  return `${JSON.stringify(content, null, 2)}\n`;
}

export interface ScaffoldInput {
  name: string;
  kind: PluginComponentKind;
  version: string;
  description: string;
}

export function buildScaffold(input: ScaffoldInput): ReadonlyMap<string, string> {
  const { name, kind, version, description } = input;
  const files = new Map<string, string>();

  files.set(".claude-plugin/plugin.json", manifestJsonContent(name, version, description));
  files.set("README.md", readmeContent(name, description));
  files.set("CHANGELOG.md", changelogContent());

  if (kind === "skills" || kind === "full") addSkillsFiles(files);
  if (kind === "agents" || kind === "full") addAgentsFiles(files);
  if (kind === "hooks" || kind === "full") addHooksFiles(files);
  if (kind === "mcp" || kind === "full") addMcpFiles(files);

  return files;
}

function addSkillsFiles(files: Map<string, string>): void {
  files.set("skills/00-example/SKILL.md", skillContent("00-example"));
  files.set("skills/00-example/actions/.gitkeep", GITKEEP_CONTENT);
  files.set("skills/00-example/references/.gitkeep", GITKEEP_CONTENT);
  files.set("skills/00-example/evals/scenarios.json", scenariosJsonContent());
  files.set("skills/00-example/assets/.gitkeep", GITKEEP_CONTENT);
}

function addAgentsFiles(files: Map<string, string>): void {
  files.set("agents/example.md", agentContent("example"));
}

function addHooksFiles(files: Map<string, string>): void {
  files.set("hooks/hooks.json", hooksJsonContent());
  files.set("hooks/routing/.gitkeep", GITKEEP_CONTENT);
}

function addMcpFiles(files: Map<string, string>): void {
  files.set(".mcp.json", mcpJsonContent());
}
