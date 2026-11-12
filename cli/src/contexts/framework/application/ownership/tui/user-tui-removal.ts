import type { FileReader } from "../../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../../kernel/ports/file-writer.js";
import type { AiToolId } from "../../../../../kernel/tool.js";
import { globalFilesOf, resolvePluginsCapability } from "../../../../tools/domain/registry.js";
import type { InstalledPlugin } from "../../../domain/plugins/installed-plugin.js";
import { planTuiRemoval } from "./tui-config.js";

export async function planUserTuiRemoval(
  fs: FileReader,
  toolId: AiToolId,
  plugin: InstalledPlugin,
  home: string
): Promise<void> {
  if (plugin.tuiPlugin === undefined) return;
  const machine = globalFilesOf(toolId);
  const tui = resolvePluginsCapability(toolId)?.startupTui;
  if (tui?.plugin !== plugin.name || machine === null)
    throw new Error(`${toolId}: cannot locate the owned TUI configuration.`);
  await planTuiRemoval(fs, machine.dir(home), home, tui.module, plugin.tuiPlugin);
}

export async function removeUserTui(
  fs: FileReader & FileWriter,
  toolId: AiToolId,
  plugin: InstalledPlugin,
  home: string
): Promise<void> {
  if (plugin.tuiPlugin === undefined) return;
  const machine = globalFilesOf(toolId);
  const tui = resolvePluginsCapability(toolId)?.startupTui;
  if (tui?.plugin !== plugin.name || machine === null)
    throw new Error(`${toolId}: cannot locate the owned TUI configuration.`);
  const plan = await planTuiRemoval(fs, machine.dir(home), home, tui.module, plugin.tuiPlugin);
  await fs.writeFile(plan.path, plan.content);
}
