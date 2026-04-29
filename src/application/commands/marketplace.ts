import type { Command } from "commander";
import type { MarketplaceScope } from "../../domain/models/marketplace.js";
import {
  describePluginSource,
  parsePluginSourceShorthand,
} from "../../domain/models/plugin-source.js";
import { createDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerMarketplaceCommand(program: Command): void {
  const marketplace = program.command("marketplace").description("Manage plugin marketplaces");

  marketplace
    .command("add <source>")
    .description("Register a plugin marketplace")
    .requiredOption("--name <slug>", "Marketplace name")
    .option("--user", "Register at user scope (default: project)")
    .option("--yes", "Skip the trust + cleanup prompts")
    .option("--overwrite", "Replace an existing marketplace with the same name")
    .option("--token <value>", "Auth token (host detected from source URL at fetch time)")
    .action(
      async (
        sourceArg: string,
        cmdOptions: {
          name: string;
          user?: boolean;
          yes?: boolean;
          overwrite?: boolean;
          token?: string;
        }
      ) => {
        const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);
        try {
          const source = parsePluginSourceShorthand(sourceArg);
          if (cmdOptions.token) process.env.AIDD_TOKEN = cmdOptions.token;
          const scope: MarketplaceScope = cmdOptions.user ? "user" : "project";
          const deps = await createDeps(projectRoot, { verbose, repo }, output);
          const result = await deps.marketplaceAddUseCase.execute({
            source,
            name: cmdOptions.name,
            scope,
            projectRoot,
            autoTrust: cmdOptions.yes ?? false,
            overwrite: cmdOptions.overwrite ?? false,
          });
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
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose, repo }, output);
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
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose, repo }, output);
        const result = await deps.marketplaceRemoveUseCase.execute({
          name,
          projectRoot,
          autoConfirm: cmdOptions.yes ?? false,
        });
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
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose, repo }, output);
        const { results, failedCount } = await deps.marketplaceRefreshUseCase.execute({
          projectRoot,
          name,
        });
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
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose, repo }, output);
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
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose, repo }, output);
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
}
