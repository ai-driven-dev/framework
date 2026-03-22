import type { Command } from "commander";
import { Manifest } from "../../domain/models/manifest.js";
import {
  assertValidToolIds,
  type ToolId,
  VALID_TOOL_IDS,
} from "../../domain/models/tool-config.js";
import { createDeps } from "../../infrastructure/deps.js";
import { AdoptRequiresVersionError } from "../errors.js";
import { requireAuth } from "../require-auth.js";
import { AdoptUseCase } from "../use-cases/adopt-use-case.js";
import { resolveFramework } from "../use-cases/resolve-framework-use-case.js";
import { parseGlobalOptions } from "./global-options.js";

export function registerAdoptCommand(program: Command): void {
  program
    .command("adopt")
    .description(
      "Bootstrap a manifest for projects with pre-existing AIDD files installed manually"
    )
    .option(
      "-t, --tools <tools>",
      "Comma-separated list of installed tools (claude, cursor, copilot)"
    )
    .option("-d, --docs-dir <dir>", "Documentation directory", Manifest.DEFAULT_DOCS_DIR)
    .option(
      "--from <version|path>",
      "(required) Framework version (e.g. 3.6.0) or local path to adopt against"
    )
    .action(async (cmdOptions: { tools?: string; docsDir: string; from?: string }) => {
      const { verbose, repo, output, projectRoot } = parseGlobalOptions(program);

      if (!cmdOptions.tools && !process.stdout.isTTY) {
        output.error("aidd adopt requires --tools in non-interactive mode.");
        process.exit(1);
      }

      try {
        const deps = await createDeps(projectRoot, { verbose, repo }, output);

        let toolIds: ToolId[];

        if (cmdOptions.tools) {
          toolIds = cmdOptions.tools.split(",").map((t) => t.trim()) as ToolId[];
          assertValidToolIds(toolIds);
        } else {
          const choices = VALID_TOOL_IDS.map((id) => ({ name: id, value: id, checked: false }));
          const selected = await deps.prompter.checkbox(
            "Which tools do you want to adopt?",
            choices
          );
          if (selected.length === 0) throw new Error("No tools selected.");
          toolIds = selected as ToolId[];
        }

        let from = cmdOptions.from;

        if (!from) {
          if (!process.stdout.isTTY) throw new AdoptRequiresVersionError(repo);
          const answer = await deps.prompter.input("Framework version tag or local path:", "");
          if (!answer) throw new AdoptRequiresVersionError(repo);
          from = answer;
        }

        const isLocalFrom =
          from.startsWith("/") ||
          from.startsWith("./") ||
          from.startsWith("../") ||
          from.endsWith(".tar.gz") ||
          from.endsWith(".tgz");
        if (!isLocalFrom) await requireAuth(deps.authReader);

        const { path: frameworkPath, version } = await resolveFramework(
          deps.resolver,
          deps.logger,
          { from }
        );

        const result = await new AdoptUseCase(
          deps.fs,
          deps.manifestRepo,
          deps.loader,
          deps.hasher,
          deps.logger,
          deps.platform
        ).execute({
          toolIds,
          frameworkPath,
          docsDir: cmdOptions.docsDir,
          projectRoot,
          version,
        });

        if (verbose) {
          for (const tool of result.tools) {
            output.debug(`Tool: ${tool.toolId}`);
            for (const f of tool.registered) output.debug(`  ~ registered: ${f}`);
          }
        }

        const toolNames = result.tools.map((t) => t.toolId).join(", ");
        const toolCount = result.tools.length;
        output.success(
          `Adopted ${toolNames} (v${version}): ${result.totalRegistered} ${result.totalRegistered === 1 ? "file" : "files"} registered across ${toolCount} ${toolCount === 1 ? "tool" : "tools"}`
        );
      } catch (error) {
        output.exit(error);
      }
    });
}
