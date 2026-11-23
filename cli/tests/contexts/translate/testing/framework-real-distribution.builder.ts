import { join, resolve } from "node:path";
import { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../src/shared/domain/plugin/plugin-name.js";
import type { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";

export const FRAMEWORK_SOURCE = resolve(process.cwd(), "tests/fixtures/framework-real");

/** The hosts a source plugin can be written for, and where each keeps its manifest. */
export const FRAMEWORK_SOURCES = [
  { name: "claude", format: TOOL.claude, manifest: ".claude-plugin/plugin.json" },
  { name: "cursor", format: TOOL.cursor, manifest: ".cursor-plugin/plugin.json" },
  { name: "codex", format: TOOL.codex, manifest: ".codex-plugin/plugin.json" },
  { name: "copilot", format: TOOL.copilot, manifest: "plugin.json" },
];

function fileAt(tree: InMemoryFileAdapter, path: string): string {
  const content = tree.getFile(path);
  if (content === undefined) throw new Error(`${path} is not in the tree`);
  return content;
}

/** One framework-real plugin read from a seeded tree, as an install receives it. */
export function distributionOf(
  tree: InMemoryFileAdapter,
  name: string,
  source = FRAMEWORK_SOURCES[0]
): PluginDistribution {
  const root = join(FRAMEWORK_SOURCE, "plugins", name);
  const files = tree.listUnder(root).map((path) => ({
    relativePath: path.slice(root.length + 1).replaceAll("\\", "/"),
    content: fileAt(tree, path),
  }));
  for (const f of files)
    if (f.relativePath === FRAMEWORK_SOURCES[0].manifest) f.relativePath = source.manifest;
  const under = (dir: string) => files.filter((f) => f.relativePath.startsWith(`${dir}/`));
  const components = {
    commands: under("commands"),
    agents: under("agents"),
    skills: under("skills"),
    rules: under("rules"),
    hooks: under("hooks"),
    mcp: files.filter((f) => f.relativePath === ".mcp.json"),
  };
  return new PluginDistribution({
    manifest: { name: parsePluginName(name), version: "1.0.0" },
    format: source.format,
    files,
    components,
  });
}
