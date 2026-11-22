import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import { printScopeIssues, printUserScopeTools } from "../../presenters/doctor.presenter.js";
import { concludeDoctor, type DoctorCmdOptions, type DoctorRun } from "./doctor-run.controller.js";

/** A user-scope install writes nothing under any project: the scenario checks the registrations
 * against the user manifest, and this prints what it finds as it finds it. */
export async function runUserScopeDoctor({
  tools,
  deps,
  output,
  projectRoot,
  cmdOptions,
}: DoctorRun & { tools: ToolCatalog; cmdOptions: DoctorCmdOptions }): Promise<void> {
  const { tool } = cmdOptions;
  const issues = await deps.runUserScopeDoctor.execute(
    { projectRoot, tool, plugin: cmdOptions.plugin },
    {
      registered: (manifest) => {
        const toolIds: readonly string[] = tool === undefined ? manifest.toolIds : [tool];
        printUserScopeTools(
          output,
          toolIds.map((id) => {
            const profile = tools.profile(id);
            const settingsFile = deps.userSettingsFileOf(id);
            return {
              toolId: profile.toolId,
              version: manifest.versionOf(id) ?? "unknown",
              settings: settingsFile ?? "no user-scope settings file",
            };
          })
        );
      },
    }
  );
  if (issues === null) {
    output.success("Nothing registered at user scope yet — run `aidd setup --global` first.");
    return;
  }
  printScopeIssues(output, "User scope", { issues });
  concludeDoctor(
    output,
    issues.every((issue) => issue.severity !== "error"),
    "\nUser-scope installation is healthy"
  );
}
