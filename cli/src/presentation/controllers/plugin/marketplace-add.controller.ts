import type { Command } from "commander";
import type { DepsSliceFactory } from "../../../orchestration/deps.js";
import type { Output } from "../../../orchestration/domain/output.js";
import { parsePluginSourceShorthand } from "../../../shared/domain/plugin/source-parsing.js";
import type { Scope } from "../../../shared/domain/scope.js";
import { printMarketplaceRegistered } from "../../presenters/plugin/marketplace.presenter.js";
import { reportNativeActivation } from "../../presenters/setup/sync.presenter.js";
import { parseGlobalOptions } from "../menu/global-options.controller.js";

/** What this command reads of the graph. */
export type MarketplaceKeys =
  | "prompter"
  | "addMarketplace"
  | "listMarketplaces"
  | "listMarketplaceCatalogs"
  | "removeUserMarketplace"
  | "removeProjectMarketplace"
  | "refreshMarketplace"
  | "checkMarketplaceUpstream"
  | "syncNativeActivation";

export interface AddOptions {
  readonly scope?: string;
  readonly yes?: boolean;
  readonly overwrite?: boolean;
  readonly token?: string;
}

/** The command `add` belongs to, and how it builds its graph. */
interface AddEnvironment {
  readonly program: Command;
  readonly createDeps: DepsSliceFactory<MarketplaceKeys>;
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
  { program, createDeps }: AddEnvironment,
  args: AddArguments,
  options: AddOptions
): Promise<void> {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  if (!process.stdout.isTTY && (!args.name || !args.source)) {
    output.error("name and source are required in non-interactive mode.");
    output.exit(1);
  }
  const scope = parseRegistrationScope(options.scope, output);
  const deps = await createDeps(projectRoot, { verbose, token: options.token }, output);
  const name = args.name ?? (await deps.prompter.input("Marketplace name:"));
  const rawSource = args.source ?? (await deps.prompter.input("Source (path or user/repo):"));
  const result = await deps.addMarketplace.execute({
    source: parsePluginSourceShorthand(rawSource),
    name,
    scope,
    projectRoot,
    autoTrust: options.yes ?? false,
    overwrite: options.overwrite ?? false,
  });
  reportNativeActivation(
    output,
    await deps.syncNativeActivation.execute({
      projectRoot,
      marketplaceNames: [result.marketplace.name],
    })
  );
  printMarketplaceRegistered(output, result.marketplace.name);
}
