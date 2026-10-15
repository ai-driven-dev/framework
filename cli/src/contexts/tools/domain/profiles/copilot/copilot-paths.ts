import { join } from "node:path";

/** Canonical path constants for the GitHub Copilot workspace layout, in a file of their own so
 * the profile and the flat-mode build helpers share one source without a cross-layer
 * dependency. */

export const COPILOT_WORKSPACE_DIR = ".github/";

export const COPILOT_VSCODE_MCP_PATH = ".vscode/mcp.json";

export const COPILOT_MARKETPLACE_RELATIVE = ".plugin/marketplace.json";
export const COPILOT_MARKETPLACE_LOCATIONS = [
  "marketplace.json",
  COPILOT_MARKETPLACE_RELATIVE,
  ".github/plugin/marketplace.json",
  ".claude-plugin/marketplace.json",
];

export function copilotConfigDir(home: string, env: NodeJS.ProcessEnv): string {
  return env.COPILOT_HOME || join(home, ".copilot");
}

export function copilotSettingsPaths(
  configDir: string,
  projectRoot: string
): readonly (readonly string[])[] {
  return [
    [join(configDir, "settings.json")],
    [
      join(projectRoot, ".claude", "settings.json"),
      join(projectRoot, ".github", "copilot", "settings.json"),
    ],
    [
      join(projectRoot, ".claude", "settings.local.json"),
      join(projectRoot, ".github", "copilot", "settings.local.json"),
    ],
  ];
}

export function copilotInstalledPluginDir(
  configDir: string,
  marketplace: string,
  plugin: string
): string {
  return join(configDir, "installed-plugins", marketplace, plugin);
}
