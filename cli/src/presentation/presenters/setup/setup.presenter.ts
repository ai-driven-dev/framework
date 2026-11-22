import type { Output } from "../../../orchestration/domain/output.js";

interface ToolInstallOutcome {
  readonly toolId: string;
  readonly fileCount: number;
  readonly files: readonly { readonly relativePath: string }[];
  readonly skipped: boolean;
  readonly warnings: readonly string[];
}

interface SetupOutcome {
  readonly kind: "initialized" | "up-to-date";
  readonly install: { readonly results: readonly ToolInstallOutcome[] };
  readonly globalPlugins?: readonly string[];
}

function debugFiles(output: Output, installed: readonly ToolInstallOutcome[]): void {
  for (const { toolId, files } of installed) {
    output.debug(`Tool: ${toolId}`);
    for (const f of files) output.debug(`  + ${f.relativePath}`);
  }
}

function displayInstall(
  output: Output,
  results: readonly ToolInstallOutcome[],
  verbose: boolean
): void {
  const skipped = results.filter((r) => r.skipped);
  const installed = results.filter((r) => !r.skipped);
  for (const r of skipped) output.warn(`${r.toolId} is already installed.`);
  for (const w of installed.flatMap((r) => r.warnings)) output.warn(w);
  if (verbose) debugFiles(output, installed);
  if (installed.length > 0) {
    const total = installed.reduce((sum, r) => sum + r.fileCount, 0);
    output.success(`Installed ${installed.map((r) => r.toolId).join(", ")} (${total} files)`);
  }
}

export function printSetupOutcome(output: Output, result: SetupOutcome, verbose: boolean): void {
  if (result.globalPlugins !== undefined) {
    output.success(
      result.globalPlugins.length === 0
        ? "Registered for every project on this machine."
        : `Installed for every project on this machine: ${result.globalPlugins.join(", ")}.`
    );
    return;
  }
  switch (result.kind) {
    case "initialized": {
      output.success("Project initialized.");
      displayInstall(output, result.install.results, verbose);
      break;
    }
    case "up-to-date": {
      output.info("Project is up to date.");
      displayInstall(output, result.install.results, verbose);
      break;
    }
  }
}

export function printDetectedContext(output: Output, description: string): void {
  output.info(`Detected: ${description}.`);
}

export function printWelcomeBanner(output: Output): void {
  output.print("");
  output.print("AI-Driven Development setup");
  output.print("Wires your AI tools, registers the framework marketplace, installs plugins.");
  output.print("Press Ctrl-C any time to abort.");
  output.print("");
}

export function printNextSteps(output: Output, installedAnything: boolean): void {
  output.print("");
  output.print("Next steps:");
  if (installedAnything) output.print("  aidd doctor             # verify drift");
  output.print("  aidd marketplace list   # see registered marketplaces");
  output.print("  aidd plugin install     # add plugins");
  output.print("  aidd --help             # explore commands");
}
