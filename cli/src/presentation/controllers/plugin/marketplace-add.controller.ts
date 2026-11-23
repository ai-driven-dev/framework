import type { Command } from "commander";
import type { ListMarketplaces } from "../../../contexts/distribution/application/list-marketplaces.use-case.js";
import type { Output } from "../../../orchestration/domain/output.js";
import type { AddMarketplace } from "../../../orchestration/marketplace/add-marketplace.use-case.js";
import type { CheckMarketplaceUpstream } from "../../../orchestration/marketplace/check-marketplace-upstream.use-case.js";
import type { ListMarketplaceCatalogs } from "../../../orchestration/marketplace/list-marketplace-catalogs.use-case.js";
import type { RefreshMarketplaces } from "../../../orchestration/marketplace/refresh-marketplaces.use-case.js";
import type { RemoveProjectMarketplace } from "../../../orchestration/marketplace/remove/remove-project-marketplace.use-case.js";
import type { RemoveUserMarketplace } from "../../../orchestration/marketplace/remove/remove-user-marketplace.use-case.js";
import type { SyncNativeActivation } from "../../../orchestration/sync/settings/sync-native-activation.use-case.js";
import { parsePluginSourceShorthand } from "../../../shared/domain/plugin/source-parsing.js";
import type { Scope } from "../../../shared/domain/scope.js";
import { printMarketplaceRegistered } from "../../presenters/plugin/marketplace.presenter.js";
import { reportNativeActivation } from "../../presenters/setup/sync.presenter.js";
import { type ContainerFactory, parseGlobalOptions } from "../menu/global-options.controller.js";
import type { MenuChoice } from "../menu/group-menu.controller.js";

/** What this command reads of the container. */
export interface MarketplaceContainer {
  shared: {
    prompter: {
      input(message: string): Promise<string>;
      select(message: string, choices: MenuChoice[]): Promise<string>;
    };
    listMarketplaces: Pick<ListMarketplaces, "execute">;
  };
  marketplace: {
    addMarketplace: Pick<AddMarketplace, "execute">;
    listMarketplaceCatalogs: Pick<ListMarketplaceCatalogs, "execute">;
    removeUserMarketplace: Pick<RemoveUserMarketplace, "execute">;
    removeProjectMarketplace: Pick<RemoveProjectMarketplace, "execute">;
    refreshMarketplace: Pick<RefreshMarketplaces, "execute">;
    checkMarketplaceUpstream: Pick<CheckMarketplaceUpstream, "execute">;
    syncNativeActivation: Pick<SyncNativeActivation, "execute">;
  };
}

export interface AddOptions {
  readonly scope?: string;
  readonly yes?: boolean;
  readonly overwrite?: boolean;
  readonly token?: string;
}

/** The command `add` belongs to, and how it builds its container. */
interface AddEnvironment {
  readonly program: Command;
  readonly containerOf: ContainerFactory<MarketplaceContainer>;
}

/** What the person typed for the marketplace, before any prompt fills the gap. */
interface AddArguments {
  readonly name: string | undefined;
  readonly source: string | undefined;
}

/** Absent means project; anything but `project` or `user` ends the run. */
export function parseRegistrationScope(raw: string | undefined, output: Output): Scope {
  if (raw !== undefined && raw !== "project" && raw !== "user") {
    output.error(`Invalid --scope '${raw}'. Expected 'project' or 'user'.`);
    return output.exit(1);
  }
  return raw === "user" ? "user" : "project";
}

export async function addMarketplaceFrom(
  { program, containerOf }: AddEnvironment,
  args: AddArguments,
  options: AddOptions
): Promise<void> {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  if (!process.stdout.isTTY && (!args.name || !args.source)) {
    output.error("name and source are required in non-interactive mode.");
    output.exit(1);
  }
  const scope = parseRegistrationScope(options.scope, output);
  const container = await containerOf(projectRoot, { verbose, token: options.token }, output);
  const name = args.name ?? (await container.shared.prompter.input("Marketplace name:"));
  const rawSource =
    args.source ?? (await container.shared.prompter.input("Source (path or user/repo):"));
  const result = await container.marketplace.addMarketplace.execute({
    source: parsePluginSourceShorthand(rawSource),
    name,
    scope,
    projectRoot,
    autoTrust: options.yes ?? false,
    overwrite: options.overwrite ?? false,
  });
  reportNativeActivation(
    output,
    await container.marketplace.syncNativeActivation.execute({
      projectRoot,
      marketplaceNames: [result.marketplace.name],
    })
  );
  printMarketplaceRegistered(output, result.marketplace.name);
}
