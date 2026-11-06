import { realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { globalFilesOf } from "../contexts/tools/domain/registry.js";
import { pathContainsOrEquals, samePath } from "../kernel/paths.js";
import { resolveHomeDir } from "../kernel/reading/home-dir.js";
import { AI_TOOL_IDS, isAiToolId } from "../kernel/tool.js";

function realOrResolved(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

/** Current flat machine paths use ~/.config. Do not claim success when the host reads elsewhere. */
export function assertMachineConfigDirectorySupported(toolIds?: readonly string[]): void {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (!xdg) return;
  const home = resolveHomeDir();
  const expected = join(home, ".config");
  if (samePath(realOrResolved(xdg), realOrResolved(expected))) return;
  const affected = (toolIds ?? AI_TOOL_IDS).filter((tool) => {
    if (!isAiToolId(tool)) return false;
    const machine = globalFilesOf(tool);
    return machine !== null && pathContainsOrEquals(resolve(expected), resolve(machine.dir(home)));
  });
  if (affected.length === 0) return;
  throw new Error(
    `${affected.join(", ")} global installation requires XDG_CONFIG_HOME to be unset or point to ~/.config. Restore that setting for setup or sync; existing installations can still be removed.`
  );
}
