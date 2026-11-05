import type { FileReader } from "../../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../../kernel/ports/file-writer.js";
import type { AiToolId } from "../../../../../kernel/tool.js";
import { globalFilesOf, resolvePluginsCapability } from "../../../../tools/domain/registry.js";
import type { InstalledPlugin } from "../../../domain/plugins/installed-plugin.js";
import { planKiloTuiRemoval } from "./kilo-tui-config.js";

export async function planUserKiloTuiRemoval(
  fs: FileReader,
  toolId: AiToolId,
  plugin: InstalledPlugin,
  home: string
): Promise<void> {
  if (plugin.tuiPlugin === undefined) return;
  const machine = globalFilesOf(toolId);
  if (resolvePluginsCapability(toolId)?.startupTui?.plugin !== plugin.name || machine === null)
    throw new Error(`${toolId}: cannot locate the owned TUI configuration.`);
  await planKiloTuiRemoval(fs, machine.dir(home), home, plugin.tuiPlugin);
}

export async function removeUserKiloTui(
  fs: FileReader & FileWriter,
  toolId: AiToolId,
  plugin: InstalledPlugin,
  home: string
): Promise<void> {
  if (plugin.tuiPlugin === undefined) return;
  const machine = globalFilesOf(toolId);
  if (resolvePluginsCapability(toolId)?.startupTui?.plugin !== plugin.name || machine === null)
    throw new Error(`${toolId}: cannot locate the owned TUI configuration.`);
  const plan = await planKiloTuiRemoval(fs, machine.dir(home), home, plugin.tuiPlugin);
  await fs.writeFile(plan.path, plan.content);
}
