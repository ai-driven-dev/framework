import { join } from "node:path";
import { InstalledPlugin } from "../../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";

export const PROJECT_ROOT = "/test-project";
export const PLUGIN = "aidd-context";
export const OTHER = "aidd-dev";
export const HOOKS_PATH = join(PROJECT_ROOT, ".cursor", "hooks.json");
export const SCRIPT_PATH = join(PROJECT_ROOT, ".cursor", "hooks", PLUGIN, "pre.js");

export function entry(plugin: string): { command: string } {
  return { command: `node ./.cursor/hooks/${plugin}/pre.js` };
}

export function hooksFile(...plugins: string[]): string {
  return JSON.stringify({ version: 1, hooks: { preToolUse: plugins.map(entry) } });
}

export function aCursorHooksPlugin(
  options: { entry?: boolean; script?: string } = {}
): InstalledPlugin {
  const command = entry(PLUGIN).command;
  return InstalledPlugin.fromJSON({
    name: PLUGIN,
    source: { kind: "local", path: "/src" },
    version: "1.0.0",
    strict: false,
    files: {},
    scope: "user",
    projectHooks: {
      entries: options.entry
        ? [
            {
              event: "preToolUse",
              command,
              digest: FileHash.of(JSON.stringify(entry(PLUGIN))).value,
            },
          ]
        : [],
      scripts:
        options.script === undefined
          ? {}
          : {
              [`.cursor/hooks/${PLUGIN}/pre.js`]: FileHash.of(options.script).value,
            },
    },
  });
}
