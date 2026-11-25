import type { Command } from "commander";
import { parseScope } from "../../../shared/domain/scope.js";
import {
  printMarketplaceCheck,
  printMarketplaceRemoved,
  printRefreshResults,
  printRegisteredMarketplaces,
} from "../../presenters/plugin/marketplace.presenter.js";
import { reportNativeActivation } from "../../presenters/setup/sync.presenter.js";
import {
  type ContainerFactory,
  parseGlobalOptions,
  TOKEN_FLAG_HELP,
} from "../menu/global-options.controller.js";
import { type MenuChoice, offerGroupMenu, type RunCommand } from "../menu/group-menu.controller.js";
import {
  type AddOptions,
  addMarketplaceFrom,
  type MarketplaceContainer,
} from "./marketplace-add.controller.js";

/** The factory of the container these commands read. */
type Factory = ContainerFactory<MarketplaceContainer>;

const MENU: readonly MenuChoice[] = [
  { name: "List marketplaces", value: "list" },
  { name: "Add marketplace", value: "add" },
  { name: "Refresh marketplaces", value: "refresh" },
  { name: "Remove marketplace", value: "remove", description: "requires name arg" },
  { name: "Check marketplaces", value: "check" },
];

function registerAdd(program: Command, marketplace: Command, containerOf: Factory): void {
  marketplace
    .command("add [name] [source]")
    .description("Register a plugin marketplace")
    .option("--scope <user|project>", "Registration scope (default: project)", "project")
    .option("--yes", "Skip the trust + cleanup prompts")
    .option("--overwrite", "Replace an existing marketplace with the same name")
    .option("--token <value>", TOKEN_FLAG_HELP)
    .action(async (name: string | undefined, source: string | undefined, options: AddOptions) =>
      addMarketplaceFrom({ program, containerOf }, { name, source }, options)
    );
}

function registerList(program: Command, marketplace: Command, containerOf: Factory): void {
  marketplace
    .command("list")
    .description("List registered plugin marketplaces")
    .option("--plugins", "Also fetch and print all plugins from each marketplace catalog")
    .action(async (cmdOptions: { plugins?: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const container = await containerOf(projectRoot, { verbose }, output);
      if (cmdOptions.plugins) {
        const { marketplaces, catalogs } =
          await container.marketplace.listMarketplaceCatalogs.execute({
            projectRoot,
          });
        printRegisteredMarketplaces(output, marketplaces, catalogs);
        return;
      }
      const { marketplaces } = await container.shared.listMarketplaces.execute({ projectRoot });
      printRegisteredMarketplaces(output, marketplaces, undefined);
    });
}

function registerRemove(program: Command, marketplace: Command, containerOf: Factory): void {
  marketplace
    .command("remove <name>")
    .description("Remove a registered plugin marketplace")
    .option("--yes", "Skip the orphan-cleanup prompt")
    .option("--scope <project|user>", "Remove from project or user scope", "project")
    .action(async (name: string, cmdOptions: { yes?: boolean; scope: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const scope = parseScope(cmdOptions.scope) ?? "project";
      const container = await containerOf(projectRoot, { verbose }, output);
      const result = await (scope === "user"
        ? container.marketplace.removeUserMarketplace
        : container.marketplace.removeProjectMarketplace
      ).execute({
        name,
        projectRoot,
        autoConfirm: cmdOptions.yes ?? false,
        scope,
      });
      if (scope !== "user") {
        reportNativeActivation(
          output,
          await container.marketplace.syncNativeActivation.execute({ projectRoot })
        );
      }
      printMarketplaceRemoved(output, result.marketplace.name, result.removedPluginCount);
    });
}

function registerRefresh(program: Command, marketplace: Command, containerOf: Factory): void {
  marketplace
    .command("refresh [name]")
    .description(
      "Refresh registered marketplaces — re-fetches catalogs; see `framework update`, which moves installed tools to a new version instead"
    )
    .option("--force", "Clear cache before re-fetching")
    .action(async (name: string | undefined, cmdOptions: { force?: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const container = await containerOf(projectRoot, { verbose }, output);
      const { results, failedCount } = await container.marketplace.refreshMarketplace.execute({
        projectRoot,
        name,
        force: cmdOptions.force,
      });
      reportNativeActivation(
        output,
        await container.marketplace.syncNativeActivation.execute({ projectRoot })
      );
      printRefreshResults(output, results);
      if (failedCount > 0) output.exit(1);
    });
}

function registerCheck(program: Command, marketplace: Command, containerOf: Factory): void {
  marketplace
    .command("check")
    .description("Report stale marketplaces and upstream-removed plugins")
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const container = await containerOf(projectRoot, { verbose }, output);
      const result = await container.marketplace.checkMarketplaceUpstream.execute({ projectRoot });
      printMarketplaceCheck(output, result);
    });
}

export function registerMarketplaceCommand(
  program: Command,
  containerOf: Factory,
  runCommand: RunCommand
): void {
  const marketplace = program.command("marketplace").description("Manage plugin marketplaces");
  offerGroupMenu(marketplace, {
    question: "marketplace: what do you want to do?",
    choices: MENU,
    containerOf,
    runCommand,
  });
  registerAdd(program, marketplace, containerOf);
  registerList(program, marketplace, containerOf);
  registerRemove(program, marketplace, containerOf);
  registerRefresh(program, marketplace, containerOf);
  registerCheck(program, marketplace, containerOf);
}
