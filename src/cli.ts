import { platform } from "node:os";
import { Command } from "commander";
import { registerAiCommand } from "./application/commands/ai.js";
import { registerAuthCommand } from "./application/commands/auth.js";
import { registerCleanCommand } from "./application/commands/clean.js";
import { registerDoctorCommand } from "./application/commands/doctor.js";
import { registerFrameworkCommand } from "./application/commands/framework.js";
import { registerIdeCommand } from "./application/commands/ide.js";
import { registerMarketplaceCommand } from "./application/commands/marketplace.js";
import { runMenuLoop } from "./application/commands/menu.js";
import { registerMigrateCommand } from "./application/commands/migrate.js";
import { registerPluginCommand } from "./application/commands/plugin.js";
import { registerRestoreCommand } from "./application/commands/restore.js";
import { registerSelfUpdateCommand } from "./application/commands/self-update.js";
import { registerSetupCommand } from "./application/commands/setup.js";
import { registerStatusCommand } from "./application/commands/status.js";
import { registerSyncCommand } from "./application/commands/sync.js";
import { registerUpdateCommand } from "./application/commands/update.js";
import { CLIOutput } from "./application/output.js";
import { CheckUpdateUseCase } from "./application/use-cases/check-update-use-case.js";
import { MigrateUseCase } from "./application/use-cases/migrate-use-case.js";
import { CurrentVersionAdapter } from "./infrastructure/adapters/current-version-adapter.js";
import { createDeps } from "./infrastructure/deps.js";

function formatVersion(version: string): string {
  return `aidd/${version} node/${process.versions.node} ${platform()}-${process.arch}`;
}

const currentVersion = new CurrentVersionAdapter().get();

const program = new Command();

program
  .name("aidd")
  .description("Generate AI coding assistant configurations from the AIDD framework")
  .version(formatVersion(currentVersion), "-V, --version", "Show version number")
  .option("--verbose", "Show detailed diagnostic output", false);

registerSetupCommand(program);
registerFrameworkCommand(program);
registerAiCommand(program);
registerIdeCommand(program);
registerPluginCommand(program);
registerMarketplaceCommand(program);
registerAuthCommand(program);
registerSyncCommand(program);
registerStatusCommand(program);
registerRestoreCommand(program);
registerUpdateCommand(program);
registerDoctorCommand(program);
registerCleanCommand(program);
registerMigrateCommand(program);
registerSelfUpdateCommand(program);

const MIGRATION_BYPASS_COMMANDS = new Set(["migrate", "self-update", "auth"]);

program.hook("preAction", async (_thisCommand, actionCommand) => {
  const opts = program.opts<{ verbose?: boolean }>();
  const output = new CLIOutput(opts.verbose ?? false);
  const deps = await createDeps(process.cwd(), { verbose: opts.verbose ?? false }, output).catch(
    () => null
  );
  if (!deps) return;
  const cmd = actionCommand.name();
  const cmdPath = resolveCommandPath(actionCommand);
  await new CheckUpdateUseCase(deps.cliUpdater, deps.currentVersionProvider, output).execute({
    skipCliCheck: cmd === "self-update",
  });
  if (MIGRATION_BYPASS_COMMANDS.has(cmd) || MIGRATION_BYPASS_COMMANDS.has(cmdPath.split(" ")[0]))
    return;
  await checkAndOfferMigration(deps, output, cmdPath);
});

function resolveCommandPath(actionCommand: Command): string {
  const parts: string[] = [];
  let current: Command | null = actionCommand;
  while (current && current.name() !== "aidd") {
    parts.unshift(current.name());
    current = current.parent;
  }
  return parts.join(" ");
}

async function checkAndOfferMigration(
  deps: Awaited<ReturnType<typeof createDeps>>,
  output: CLIOutput,
  cmdPath: string
): Promise<void> {
  const projectRoot = process.cwd();
  const useCase = new MigrateUseCase(
    deps.fs,
    deps.manifestRepo,
    deps.logger,
    deps.prompter,
    deps.marketplaceRegisterFrameworkUseCase,
    deps.migrateBackupUseCase,
    deps.migrateStripDeadFilesUseCase,
    deps.migrateRewirePluginsUseCase,
    deps.marketplaceRegistry
  );
  const dryRun = await useCase.execute({ projectRoot, interactive: false, dryRun: true });
  if (dryRun.kind !== "dry-run" || !needsSchemaUpgrade(dryRun.plan)) return;
  if (!process.stdout.isTTY) {
    output.error(
      `Outdated manifest detected. Run \`aidd migrate\` to update before running \`aidd ${cmdPath}\`.`
    );
    process.exit(1);
  }
  const proceed = await deps.prompter.confirm("Outdated manifest detected. Migrate now?", true);
  if (!proceed) {
    output.warn(`Skipping migration. Run \`aidd migrate\` later to update.`);
    return;
  }
  await useCase.execute({ projectRoot, interactive: true, dryRun: false });
  output.success("Migration complete.");
}

function needsSchemaUpgrade(
  plan: import("./domain/models/migration-plan.js").MigrationPlan | undefined
): boolean {
  if (plan === undefined) return false;
  return plan.fromVersion < 5 || plan.fieldsToStrip.length > 0 || plan.filesToDelete.length > 0;
}

const cliArgs = process.argv.slice(2);

if (cliArgs.length === 0 && process.stdout.isTTY) {
  runMenuLoop();
} else {
  program.parse(process.argv);
}
