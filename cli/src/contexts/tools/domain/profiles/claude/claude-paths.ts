import { join } from "node:path";

export function claudeConfigDir(home: string, env: NodeJS.ProcessEnv): string {
  return env.CLAUDE_CONFIG_DIR || join(home, ".claude");
}

export function claudePluginsDir(home: string, env: NodeJS.ProcessEnv): string {
  return env.CLAUDE_CODE_PLUGIN_CACHE_DIR || join(claudeConfigDir(home, env), "plugins");
}
