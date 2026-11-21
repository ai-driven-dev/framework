import type { Command } from "commander";
import type { CommandRunner, DepsSliceFactory } from "../../orchestration/deps.js";
import { parseScope } from "../../shared/domain/scope.js";
import {
  printMarketplaceCheck,
  printMarketplaceRemoved,
  printRefreshResults,
  printRegisteredMarketplaces,
} from "../display/marketplace-display.js";
import { reportNativeActivation } from "../display/sync-display.js";
import { parseGlobalOptions, TOKEN_FLAG_HELP } from "./global-options.js";
import { type MenuChoice, offerGroupMenu } from "./group-menu.js";
import { type AddOptions, addMarketplaceFrom, type MarketplaceKeys } from "./marketplace-add.js";

const MENU: readonly MenuChoice[] = [
  { name: "List marketplaces", value: "list" },
  { name: "Add marketplace", value: "add" },
  { name: "Refresh marketplaces", value: "refresh" },
  { name: "Remove marketplace", value: "remove", description: "requires name arg" },
  { name: "Check marketplaces", value: "check" },
];

function registerAdd(
  program: Command,
  marketplace: Command,
  createDeps: DepsSliceFactory<MarketplaceKeys>
): void {
  marketplace
    .command("add [name] [source]")
    .description("Register a plugin marketplace")
    .option("--scope <user|project>", "Registration scope (default: project)", "project")
    .option("--yes", "Skip the trust + cleanup prompts")
    .option("--overwrite", "Replace an existing marketplace with the same name")
    .option("--token <value>", TOKEN_FLAG_HELP)
    .action(async (name: string | undefined, source: string | undefined, options: AddOptions) =>
      addMarketplaceFrom({ program, createDeps }, { name, source }, options)
    );
}

function registerList(
  program: Command,
  marketplace: Command,
  createDeps: DepsSliceFactory<MarketplaceKeys>
): void {
  marketplace
    .command("list")
    .description("List registered plugin marketplaces")
    .option("--plugins", "Also fetch and print all plugins from each marketplace catalog")
    .action(async (cmdOptions: { plugins?: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const deps = await createDeps(projectRoot, { verbose }, output);
      const { marketplaces, catalogs } = await deps.listMarketplaces.execute({
        projectRoot,
        withCatalogs: cmdOptions.plugins ?? false,
      });
      printRegisteredMarketplaces(output, marketplaces, catalogs);
    });
}

function registerRemove(
  program: Command,
  marketplace: Command,
  createDeps: DepsSliceFactory<MarketplaceKeys>
): void {
  marketplace
    .command("remove <name>")
    .description("Remove a registered plugin marketplace")
    .option("--yes", "Skip the orphan-cleanup prompt")
    .option("--scope <project|user>", "Remove from project or user scope", "project")
    .action(async (name: string, cmdOptions: { yes?: boolean; scope: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const scope = parseScope(cmdOptions.scope) ?? "project";
      const deps = await createDeps(projectRoot, { verbose }, output);
      const result = await (scope === "user"
        ? deps.userMarketplaceRemoveUseCase
        : deps.marketplaceRemoveUseCase
      ).execute({
        name,
        projectRoot,
        autoConfirm: cmdOptions.yes ?? false,
        scope,
      });
      if (scope !== "user") {
        reportNativeActivation(output, await deps.syncNativeActivation.execute({ projectRoot }));
      }
      printMarketplaceRemoved(output, result.marketplace.name, result.removedPluginCount);
    });
}

function registerRefresh(
  program: Command,
  marketplace: Command,
  createDeps: DepsSliceFactory<MarketplaceKeys>
): void {
  marketplace
    .command("refresh [name]")
    .description(
      "Refresh registered marketplaces — re-fetches catalogs; see `framework update`, which moves installed tools to a new version instead"
    )
    .option("--force", "Clear cache before re-fetching")
    .action(async (name: string | undefined, cmdOptions: { force?: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const deps = await createDeps(projectRoot, { verbose }, output);
      const { results, failedCount } = await deps.refreshMarketplace.execute({
        projectRoot,
        name,
        force: cmdOptions.force,
      });
      reportNativeActivation(output, await deps.syncNativeActivation.execute({ projectRoot }));
      printRefreshResults(output, results);
      if (failedCount > 0) output.exit(1);
    });
}

function registerCheck(
  program: Command,
  marketplace: Command,
  createDeps: DepsSliceFactory<MarketplaceKeys>
): void {
  marketplace
    .command("check")
    .description("Report stale marketplaces and upstream-removed plugins")
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const deps = await createDeps(projectRoot, { verbose }, output);
      const result = await deps.marketplaceCheckUseCase.execute({ projectRoot });
      printMarketplaceCheck(output, result);
    });
}

export function registerMarketplaceCommand(
  program: Command,
  createDeps: DepsSliceFactory<MarketplaceKeys>,
  runCommand: CommandRunner
): void {
  const marketplace = program.command("marketplace").description("Manage plugin marketplaces");
  offerGroupMenu(marketplace, {
    question: "marketplace: what do you want to do?",
    choices: MENU,
    createDeps,
    runCommand,
  });
  registerAdd(program, marketplace, createDeps);
  registerList(program, marketplace, createDeps);
  registerRemove(program, marketplace, createDeps);
  registerRefresh(program, marketplace, createDeps);
  registerCheck(program, marketplace, createDeps);
}
