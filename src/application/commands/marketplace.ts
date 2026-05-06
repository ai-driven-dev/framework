import type { Command } from "commander";
import type { MarketplaceScope } from "../../domain/models/marketplace.js";
import {
  describePluginSource,
  parsePluginSourceShorthand,
} from "../../domain/models/plugin-source.js";
import { MarketplaceCacheAdapter } from "../../infrastructure/adapters/marketplace-cache-adapter.js";
import { createDeps, createMenuDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { MarketplaceCacheClearUseCase } from "../use-cases/marketplace/marketplace-cache-clear-use-case.js";
import { MarketplaceCacheListUseCase } from "../use-cases/marketplace/marketplace-cache-list-use-case.js";
import { parseGlobalOptions } from "./global-options.js";
import { spawnCliCommand } from "./shared/spawn-cli-command.js";

export function registerMarketplaceCommand(program: Command): void {
  const marketplace = program.command("marketplace").description("Manage plugin marketplaces");

  marketplace.action(async () => {
    if (!process.stdout.isTTY) {
      marketplace.help();
      return;
    }
    const { prompter } = createMenuDeps(process.cwd());
    const choice = await prompter.select("marketplace: what do you want to do?", [
      { name: "List marketplaces", value: "list" },
      { name: "Add marketplace", value: "add" },
      { name: "Browse marketplace", value: "browse", description: "requires name arg" },
      { name: "Refresh marketplaces", value: "refresh" },
      { name: "Remove marketplace", value: "remove", description: "requires name arg" },
      { name: "Check marketplaces", value: "check" },
    ]);
    await spawnCliCommand(["marketplace", choice]);
  });

  marketplace
    .command("add [name] [source]")
    .description("Register a plugin marketplace")
    .option("--user", "Register at user scope (default: project)")
    .option("--yes", "Skip the trust + cleanup prompts")
    .option("--overwrite", "Replace an existing marketplace with the same name")
    .option("--token <value>", "Auth token (host detected from source URL at fetch time)")
    .action(
      async (
        nameArg: string | undefined,
        sourceArg: string | undefined,
        cmdOptions: {
          user?: boolean;
          yes?: boolean;
          overwrite?: boolean;
          token?: string;
        }
      ) => {
        const { verbose, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);
        const interactive = process.stdout.isTTY;
        if (!interactive && (!nameArg || !sourceArg)) {
          output.error("name and source are required in non-interactive mode.");
          process.exit(1);
        }
        try {
          if (cmdOptions.token) process.env.AIDD_TOKEN = cmdOptions.token;
          const scope: MarketplaceScope = cmdOptions.user ? "user" : "project";
          const deps = await createDeps(projectRoot, { verbose }, output);
          const name = nameArg ?? (await deps.prompter.input("Marketplace name:"));
          const rawSource = sourceArg ?? (await deps.prompter.input("Source (path or user/repo):"));
          const source = parsePluginSourceShorthand(rawSource);
          const result = await deps.marketplaceAddUseCase.execute({
            source,
            name,
            scope,
            projectRoot,
            autoTrust: cmdOptions.yes ?? false,
            overwrite: cmdOptions.overwrite ?? false,
          });
          await deps.marketplaceSyncSettingsUseCase.execute({ projectRoot });
          output.success(`Marketplace '${result.marketplace.name}' registered.`);
        } catch (error) {
          errorHandler.handle(error);
        }
      }
    );

  marketplace
    .command("list")
    .description("List registered plugin marketplaces")
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const { marketplaces } = await deps.marketplaceListUseCase.execute({ projectRoot });
        if (marketplaces.length === 0) output.info("No marketplaces registered.");
        for (const m of marketplaces) output.print(`${m.name} [${m.scope}]`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  marketplace
    .command("remove <name>")
    .description("Remove a registered plugin marketplace")
    .option("--yes", "Skip the orphan-cleanup prompt")
    .action(async (name: string, cmdOptions: { yes?: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const result = await deps.marketplaceRemoveUseCase.execute({
          name,
          projectRoot,
          autoConfirm: cmdOptions.yes ?? false,
        });
        await deps.marketplaceSyncSettingsUseCase.execute({ projectRoot });
        output.success(
          `Marketplace '${result.marketplace.name}' removed (${result.removedPluginCount} plugin(s) cleaned up).`
        );
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  marketplace
    .command("refresh [name]")
    .description("Refresh registered marketplaces")
    .action(async (name: string | undefined) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const { results, failedCount } = await deps.marketplaceRefreshUseCase.execute({
          projectRoot,
          name,
        });
        await deps.marketplaceSyncSettingsUseCase.execute({ projectRoot });
        for (const r of results)
          output.print(`${r.name}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
        if (failedCount > 0) process.exit(1);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  marketplace
    .command("browse <name>")
    .description("Browse plugins in a registered marketplace")
    .option("--use-cache", "Use the cached catalog if fetch fails")
    .action(async (name: string, cmdOptions: { useCache?: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const { catalog, fromCache } = await deps.marketplaceBrowseUseCase.execute({
          name,
          projectRoot,
          useCachedOnFailure: cmdOptions.useCache ?? false,
        });
        if (fromCache) output.warn("Showing cached catalog.");
        for (const e of catalog.plugins) {
          const flag = e.recommended ? " (recommended)" : "";
          output.print(
            `${e.name}@${e.version ?? "?"} — ${e.description ?? ""} — ${describePluginSource(e.source)}${flag}`
          );
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  marketplace
    .command("check")
    .description("Report stale marketplaces and upstream-removed plugins")
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const { stale, upstreamRemoved, skipped } = await deps.marketplaceCheckUseCase.execute({
          projectRoot,
        });
        for (const m of stale) output.print(`stale: ${m.name}`);
        for (const r of upstreamRemoved)
          output.print(`removed: ${r.marketplace}/${r.plugin} (${r.toolId})`);
        for (const s of skipped) output.warn(`skipped: ${s.marketplace} — ${s.error}`);
        if (stale.length === 0 && upstreamRemoved.length === 0 && skipped.length === 0)
          output.success("All marketplaces fresh.");
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  const cache = marketplace.command("cache").description("Manage marketplace fetch cache");

  cache
    .command("list")
    .description("List cached marketplaces with size and last fetch time")
    .action(async () => {
      const { output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const adapter = new MarketplaceCacheAdapter(projectRoot);
        const { entries } = await new MarketplaceCacheListUseCase(adapter).execute();
        if (entries.length === 0) {
          output.info("No cached marketplaces.");
          return;
        }
        for (const e of entries) {
          const size = `${(e.sizeBytes / 1024).toFixed(1)}KB`;
          const fetched = e.lastFetchedAt ? e.lastFetchedAt.toISOString() : "unknown";
          output.print(`${e.name}  ${size}  last fetched: ${fetched}`);
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  cache
    .command("clear [name]")
    .description("Clear marketplace cache for one or all marketplaces")
    .option("--all", "Clear all cached marketplaces")
    .action(async (nameArg: string | undefined, cmdOptions: { all?: boolean }) => {
      const { output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const adapter = new MarketplaceCacheAdapter(projectRoot);
        const listUseCase = new MarketplaceCacheListUseCase(adapter);
        const clearUseCase = new MarketplaceCacheClearUseCase(adapter);
        const interactive = process.stdout.isTTY;

        const name = nameArg;
        let all = cmdOptions.all ?? false;

        if (!name && !all) {
          if (!interactive) {
            output.error("Non-interactive mode: provide a marketplace name or --all.");
            process.exit(1);
          }
          const { entries } = await listUseCase.execute();
          if (entries.length === 0) {
            output.info("No cached marketplaces.");
            return;
          }
          const { prompter } = createMenuDeps(projectRoot);
          const selected = await prompter.checkbox(
            "Select marketplaces to clear:",
            entries.map((e) => ({ name: e.name, value: e.name }))
          );
          if (selected.length === 0) {
            output.info("No selection.");
            return;
          }
          if (selected.length === entries.length) {
            all = true;
          } else {
            for (const n of selected) {
              await clearUseCase.execute({ name: n });
            }
            output.success(`Cleared: ${selected.join(", ")}`);
            return;
          }
        }

        const result = await clearUseCase.execute({ name, all });
        if (result.cleared.length === 0) {
          output.info("Nothing to clear.");
          return;
        }
        output.success(`Cleared: ${result.cleared.join(", ")}`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
