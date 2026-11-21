import { PluginDistribution } from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";

/** A plugin's canon holding `files`, named from the plugin root, sorted into its components. */
export function aCanon(name: string, files: Record<string, string>): PluginDistribution {
  const all = Object.entries(files).map(([relativePath, content]) => ({ relativePath, content }));
  const under = (dir: string) => all.filter((file) => file.relativePath.startsWith(`${dir}/`));
  return new PluginDistribution({
    manifest: { name, version: "" },
    format: TOOL.claude,
    files: all,
    components: {
      commands: under("commands"),
      agents: under("agents"),
      skills: under("skills"),
      rules: under("rules"),
      hooks: under("hooks"),
      mcp: all.filter((file) => file.relativePath === ".mcp.json"),
    },
  });
}
