import type { Command } from "commander";
import type { DepsSliceFactory } from "../../orchestration/deps.js";
import { outputOf } from "../controllers/global-options.controller.js";
import { render } from "../errors/error-translator.presenter.js";

/** What this command reads of the graph. */
type UpdateNoticeKeys = "printUpdateNotice" | "logger" | "refreshUpdateCheck";

// Commands already paying for network I/O, so the update-check refresh rides one of them.
// `marketplace remove` is offline and `update` already resolves the latest version itself.
const ONLINE_COMMAND_PATHS = new Set([
  "marketplace refresh",
  "marketplace check",
  "marketplace list",
  "marketplace add",
  "sync",
]);

/** The graph a hook reads, or nothing when it cannot be built: a hook never fails the command. */
function graphOf(program: Command, createDeps: DepsSliceFactory<UpdateNoticeKeys>) {
  const { verbose } = program.opts<{ verbose?: boolean }>();
  return createDeps(process.cwd(), { verbose: verbose ?? false }, outputOf(program)).catch(
    () => null
  );
}

/** The lines that tell a person a newer release exists and what to run. */
export function describeUpdateNotice({
  current,
  latest,
}: {
  current: string;
  latest: string;
}): string[] {
  return [`CLI update available: v${current} → v${latest}`, "Run `aidd update`."];
}

export function registerUpdateNoticeHooks(
  program: Command,
  createDeps: DepsSliceFactory<UpdateNoticeKeys>
): void {
  program.hook("preAction", async (_thisCommand, actionCommand) => {
    if (process.env.AIDD_SKIP_UPDATE_CHECK === "1") return;
    // A hook runs `telemetry ingest --quiet`; an update notice would break its silence.
    if (resolveCommandPath(actionCommand).startsWith("telemetry")) return;
    const deps = await graphOf(program, createDeps);
    if (!deps) return;
    // A bare verb with no subject means "the CLI itself" (Claude Code/Codex convention):
    // `update` resolves the latest version on its own, so the generic check is redundant.
    if (actionCommand.name() === "update") return;
    await deps.printUpdateNotice
      .execute()
      .then(({ notice }) => {
        if (notice === null) return;
        for (const line of describeUpdateNotice(notice)) deps.logger.warn(line);
      })
      .catch((err: unknown) => {
        deps.logger.debug(`CLI update check failed: ${render(err)}`);
      });
  });

  program.hook("postAction", async (_thisCommand, actionCommand) => {
    // The refresh asks GitHub what the latest release is and caches the answer, so any
    // run that performs it produces output depending on what has been published since.
    // A test suite that captures output cannot afford that: every release would rewrite
    // its expectations. Same switch shape as AIDD_SKIP_MARKETPLACE_REFRESH, same reason.
    if (process.env.AIDD_SKIP_UPDATE_CHECK === "1") return;
    if (!ONLINE_COMMAND_PATHS.has(resolveCommandPath(actionCommand))) return;
    const deps = await graphOf(program, createDeps);
    if (!deps) return;
    await deps.refreshUpdateCheck.execute().catch((err: unknown) => {
      deps.logger.debug(`CLI update refresh failed: ${render(err)}`);
    });
  });
}

function resolveCommandPath(actionCommand: Command): string {
  const parts: string[] = [];
  let current: Command | null = actionCommand;
  while (current && current.name() !== "aidd") {
    parts.unshift(current.name());
    current = current.parent;
  }
  return parts.join(" ");
}
