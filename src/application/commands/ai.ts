import type { Command } from "commander";
import { Manifest } from "../../domain/models/manifest.js";
import type { AiToolId } from "../../domain/models/tool-ids.js";
import { AI_TOOL_IDS } from "../../domain/models/tool-ids.js";
import type { ToolId } from "../../domain/tools/registry.js";
import { createDeps, createMenuDeps } from "../../infrastructure/deps.js";
import { ErrorHandler } from "../error-handler.js";
import { UninstallUseCase } from "../use-cases/uninstall-use-case.js";
import { parseGlobalOptions } from "./global-options.js";
import { spawnCliCommand } from "./shared/spawn-cli-command.js";

function assertAiToolId(toolId: string): asserts toolId is AiToolId {
  if (!(AI_TOOL_IDS as readonly string[]).includes(toolId)) {
    throw new Error(`Unknown AI tool: ${toolId}. Valid AI tools: ${AI_TOOL_IDS.join(", ")}`);
  }
}

export function registerAiCommand(program: Command): void {
  const ai = program
    .command("ai")
    .description("Manage AI tools (claude, cursor, copilot, codex, opencode)");

  ai.action(async () => {
    if (!process.stdout.isTTY) {
      ai.help();
      return;
    }
    const { prompter } = createMenuDeps(process.cwd());
    const choice = await prompter.select("ai: what do you want to do?", [
      { name: "Install an AI tool", value: "install", description: "requires tool arg" },
      { name: "Uninstall an AI tool", value: "uninstall", description: "requires tool arg" },
      { name: "List installed AI tools", value: "list" },
      { name: "Show AI tool status", value: "status" },
      { name: "Update AI tools", value: "update" },
      { name: "Sync AI tools", value: "sync", description: "requires --source" },
      { name: "Restore AI tool files", value: "restore" },
      { name: "Doctor AI tools", value: "doctor" },
    ]);
    await spawnCliCommand(["ai", choice]);
  });

  ai.command("install <tool>")
    .description("Install an AI tool runtime configuration from bundled assets")
    .option("-f, --force", "Overwrite already-installed tool", false)
    .action(async (toolArg: string, cmdOptions: { force: boolean }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        assertAiToolId(toolArg);
        const deps = await createDeps(projectRoot, { verbose }, output);
        const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
        const version = deps.currentVersionProvider.get();
        const result = await deps.installRuntimeConfigUseCase.execute({
          toolId: toolArg,
          projectRoot,
          manifest,
          force: cmdOptions.force,
          version,
        });
        if (result.skipped) {
          output.warn(`${result.toolId} is already installed. Use \`--force\` to reinstall.`);
          return;
        }
        for (const w of result.warnings) output.warn(w);
        output.success(`Installed ${result.toolId} (${result.fileCount} files)`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  ai.command("uninstall <tool>")
    .description("Remove an AI tool's generated configuration files")
    .action(async (toolArg: string) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        assertAiToolId(toolArg);
        const deps = await createDeps(projectRoot, { verbose }, output);
        const useCase = new UninstallUseCase(deps.fs, deps.manifestRepo, deps.logger);
        const results = await useCase.execute({
          toolIds: [toolArg as ToolId],
          projectRoot,
          mcpFilter: [],
        });
        const totalFileCount = results.reduce((sum, r) => sum + r.fileCount, 0);
        output.success(`Uninstalled ${results[0].toolId} (${totalFileCount} files removed)`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  ai.command("list")
    .description("List installed AI tools")
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const manifest = await deps.manifestRepo.load();
        if (!manifest) {
          output.info("No tools installed. Run `aidd setup` to get started.");
          return;
        }
        const aiIds = manifest
          .getInstalledToolIds()
          .filter((id) => (AI_TOOL_IDS as readonly string[]).includes(id));
        if (aiIds.length === 0) {
          output.info("No AI tools installed.");
          return;
        }
        for (const id of aiIds) output.print(id);
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  ai.command("status")
    .description("Show drift for AI tools")
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const { StatusUseCase } = await import("../use-cases/status-use-case.js");
        const useCase = new StatusUseCase(deps.fs, deps.manifestRepo, deps.logger, deps.hasher);
        const report = await useCase.execute({
          projectRoot,
          filterToolId: undefined,
          category: "ai",
        });
        if (report.inSync) {
          output.success("All AI tool files are in sync");
          return;
        }
        for (const tool of report.tools) {
          if (tool.drifted.length === 0) {
            output.print(`${tool.toolId} (v${tool.version}): in sync`);
            continue;
          }
          output.print(`${tool.toolId} (v${tool.version}):`);
          for (const f of tool.drifted) output.print(`  ${f.status} ${f.relativePath}`);
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  ai.command("update [tool]")
    .description("Re-install AI tool configs from bundled CLI assets (force overwrite)")
    .action(async (toolArg: string | undefined) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        if (toolArg !== undefined) assertAiToolId(toolArg);
        const deps = await createDeps(projectRoot, { verbose }, output);
        const manifest = (await deps.manifestRepo.load()) ?? Manifest.create();
        const installedAiIds = manifest
          .getInstalledToolIds()
          .filter((id) => (AI_TOOL_IDS as readonly string[]).includes(id)) as AiToolId[];
        const targetIds: AiToolId[] = toolArg ? [toolArg] : installedAiIds;
        if (targetIds.length === 0) {
          output.info("No AI tools installed.");
          return;
        }
        const version = deps.currentVersionProvider.get();
        for (const toolId of targetIds) {
          const result = await deps.installRuntimeConfigUseCase.execute({
            toolId,
            projectRoot,
            manifest,
            force: true,
            version,
          });
          for (const w of result.warnings) output.warn(w);
          if (!result.skipped)
            output.success(`Updated ${result.toolId} (${result.fileCount} files)`);
        }
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  ai.command("sync")
    .description("Propagate local modifications from one AI tool to others")
    .option("--source <tool>", "Source tool to sync from")
    .option("--target <tool>", "Target tool to sync to (default: all other installed tools)")
    .option("-f, --force", "Overwrite conflicting files without prompting", false)
    .option("--include-user-files", "Also sync user-created files not tracked in manifest", false)
    .option("--no-plugins", "Skip plugin propagation (sync configs only)")
    .action(
      async (cmdOptions: {
        source?: string;
        target?: string;
        force: boolean;
        includeUserFiles: boolean;
        plugins: boolean;
      }) => {
        const { verbose, output, projectRoot } = parseGlobalOptions(program);
        const errorHandler = new ErrorHandler(output);
        if (!cmdOptions.source && !process.stdout.isTTY) {
          output.error("--source <tool> is required in non-interactive mode.");
          process.exit(1);
        }
        try {
          if (cmdOptions.source !== undefined) {
            assertAiToolId(cmdOptions.source);
          }
          if (cmdOptions.target !== undefined) {
            assertAiToolId(cmdOptions.target);
          }
          const deps = await createDeps(projectRoot, { verbose }, output);
          const { SyncUseCase } = await import("../use-cases/sync/sync-use-case.js");
          const { SyncPluginsUseCase } = await import("../use-cases/sync/sync-plugins-use-case.js");
          const syncPluginsUseCase = cmdOptions.plugins
            ? new SyncPluginsUseCase(
                deps.manifestRepo,
                deps.pluginInstallFromMarketplaceUseCase,
                deps.logger
              )
            : undefined;
          const syncUseCase = new SyncUseCase(
            deps.fs,
            deps.manifestRepo,
            deps.hasher,
            deps.syncSourceResolverUseCase,
            deps.syncFilePropagationUseCase,
            syncPluginsUseCase
          );
          const result = await syncUseCase.execute({
            projectRoot,
            sourceTool: cmdOptions.source as ToolId | undefined,
            targetTools: cmdOptions.target ? [cmdOptions.target as ToolId] : undefined,
            force: cmdOptions.force,
            includeUserFiles: cmdOptions.includeUserFiles,
            interactive: process.stdout.isTTY,
            includePlugins: cmdOptions.plugins,
          });
          const { totalWritten, totalDeleted, totalConflicts } = result;
          if (totalWritten === 0 && totalDeleted === 0 && totalConflicts === 0) {
            output.success("Nothing to sync.");
            return;
          }
          if (totalConflicts > 0) {
            output.warn(`${totalConflicts} conflict(s) skipped. Use --force to overwrite.`);
          }
          output.success(
            `Synced ${totalWritten} ${totalWritten === 1 ? "file" : "files"}, deleted ${totalDeleted} from ${result.sourceTool}`
          );
        } catch (error) {
          errorHandler.handle(error);
        }
      }
    );

  ai.command("restore [files...]")
    .description("Restore AI tool tracked files to their installed version")
    .option("-f, --force", "Restore without prompting", false)
    .option("--tool <tool>", "Limit restore to a specific AI tool")
    .action(async (fileArgs: string[], cmdOptions: { force: boolean; tool?: string }) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        if (cmdOptions.tool !== undefined) {
          assertAiToolId(cmdOptions.tool);
        }
        const deps = await createDeps(projectRoot, { verbose }, output);
        const { NoManifestError } = await import("../errors.js");
        const manifest = await deps.manifestRepo.load();
        if (!manifest) throw new NoManifestError();
        const version =
          manifest
            .getInstalledToolIds()
            .map((id) => manifest.getToolVersion(id))
            .find((v) => v !== undefined) ?? deps.currentVersionProvider.get();
        const toolIds: ToolId[] | undefined = cmdOptions.tool
          ? [cmdOptions.tool as ToolId]
          : (manifest
              .getInstalledToolIds()
              .filter((id) => (AI_TOOL_IDS as readonly string[]).includes(id)) as ToolId[]);
        const { DOCS_DIR } = await import("../../domain/models/paths.js");
        const { RestoreUseCase } = await import("../use-cases/restore/restore-use-case.js");
        const restoreUseCase = new RestoreUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.hasher,
          deps.logger,
          deps.platform,
          deps.prompter,
          deps.pluginFetcher,
          deps.pluginDistributionReader
        );
        const result = await restoreUseCase.execute({
          version,
          docsDir: DOCS_DIR,
          projectRoot,
          toolIds,
          files: fileArgs.length > 0 ? fileArgs : undefined,
          force: cmdOptions.force,
          interactive: process.stdout.isTTY,
          manifest,
        });
        const nothingDone = result.tools.every((t) => t.nothingToRestore);
        if (nothingDone) {
          output.success("Nothing to restore — all files are unmodified.");
          return;
        }
        const restored = result.totalRestored;
        const kept = result.totalKept;
        output.success(
          `Restored ${restored} ${restored === 1 ? "file" : "files"}, kept ${kept} ${kept === 1 ? "file" : "files"}`
        );
      } catch (error) {
        errorHandler.handle(error);
      }
    });

  ai.command("doctor")
    .description("Check AI tool installation health and detect issues")
    .action(async () => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);
      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const { DoctorUseCase } = await import("../use-cases/doctor-use-case.js");
        const useCase = new DoctorUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.hasher,
          deps.logger,
          deps.authReader
        );
        const report = await useCase.execute({ projectRoot, category: "ai" });
        if (report.healthy) {
          output.success("AI tool installation is healthy");
          return;
        }
        for (const issue of report.issues) {
          const text = `${issue.message}\n  Fix: ${issue.fix}`;
          if (issue.severity === "error") output.error(text);
          else output.warn(text);
        }
        process.exit(1);
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
