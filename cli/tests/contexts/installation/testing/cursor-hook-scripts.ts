import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.js";

/** The folder Cursor's profile keeps one plugin's copied hook scripts in, as it answers it. */
export function cursorHookScriptDir(plugin: string): string {
  const hooks = registeredTools().aiProfile(TOOL.cursor).projectHooksDelivery();
  if (hooks === null) throw new Error("cursor delivers no project hooks");
  return hooks.format.scriptDir(plugin);
}
