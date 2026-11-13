import type { Command } from "commander";
import type { DepsFactory } from "../deps.js";
import { CLIOutput } from "../output.js";

// Commands already paying for network I/O, so the update-check refresh rides one of them.
// `marketplace remove` is offline and `update` already resolves the latest version itself.
const ONLINE_COMMAND_PATHS = new Set([
  "marketplace refresh",
  "marketplace check",
  "marketplace list",
  "marketplace add",
  "sync",
]);

export function registerUpdateNoticeHooks(program: Command, createDeps: DepsFactory): void {
  program.hook("preAction", async (_thisCommand, actionCommand) => {
    if (process.env.AIDD_SKIP_UPDATE_CHECK === "1") return;
    // A hook runs `telemetry ingest --quiet`; an update notice would break its silence.
    if (resolveCommandPath(actionCommand).startsWith("telemetry")) return;
    const opts = program.opts<{ verbose?: boolean }>();
    const output = new CLIOutput(opts.verbose ?? false);
    const deps = await createDeps(process.cwd(), { verbose: opts.verbose ?? false }, output).catch(
      () => null
    );
    if (!deps) return;
    // A bare verb with no subject means "the CLI itself" (Claude Code/Codex convention):
    // `update` resolves the latest version on its own, so the generic check is redundant.
    if (actionCommand.name() === "update") return;
    await deps.printUpdateNotice
      .execute()
      .then(({ lines }) => {
        for (const line of lines) deps.logger.warn(line);
      })
      .catch((err: unknown) => {
        deps.logger.debug(
          `CLI update check failed: ${err instanceof Error ? err.message : String(err)}`
        );
      });
  });

  program.hook("postAction", async (_thisCommand, actionCommand) => {
    // The refresh asks GitHub what the latest release is and caches the answer, so any
    // run that performs it produces output depending on what has been published since.
    // A test suite that captures output cannot afford that: every release would rewrite
    // its expectations. Same switch shape as AIDD_SKIP_MARKETPLACE_REFRESH, same reason.
    if (process.env.AIDD_SKIP_UPDATE_CHECK === "1") return;
    if (!ONLINE_COMMAND_PATHS.has(resolveCommandPath(actionCommand))) return;
    const opts = program.opts<{ verbose?: boolean }>();
    const output = new CLIOutput(opts.verbose ?? false);
    const deps = await createDeps(process.cwd(), { verbose: opts.verbose ?? false }, output).catch(
      () => null
    );
    if (!deps) return;
    await deps.refreshUpdateCheck.execute().catch((err: unknown) => {
      deps.logger.debug(
        `CLI update refresh failed: ${err instanceof Error ? err.message : String(err)}`
      );
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
