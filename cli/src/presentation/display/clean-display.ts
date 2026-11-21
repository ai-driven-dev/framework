import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import type { Output } from "../../orchestration/domain/output.js";

interface ProjectCleanResult {
  readonly manifestFound: boolean;
  readonly dryRun: boolean;
  readonly fileCount: number;
  readonly preview: {
    readonly tools: readonly { readonly toolId: string; readonly fileCount: number }[];
    readonly nativeRegistrations: readonly {
      readonly toolId: string;
      readonly binary: string;
      readonly marketplaceCount: number;
      readonly pluginRefCount: number;
      readonly cachePaths: readonly string[];
    }[];
    readonly sharedSourceOtherProjects?: readonly string[];
    readonly totalFileCount: number;
  };
}

interface UserScopeCleanResult {
  readonly dryRun: boolean;
  readonly manifestFound: boolean;
  readonly preview: {
    readonly toolIds: readonly string[];
    readonly builtVersions: readonly string[];
    readonly referencingProjects: readonly string[];
  };
}

function printProjectPreview(output: Output, preview: ProjectCleanResult["preview"]): void {
  output.print("The following will be removed:");
  for (const tool of preview.tools) {
    output.print(`  ${tool.toolId}: ${tool.fileCount} files`);
  }
  output.print("  manifest: .aidd/ (config.json, if present, is kept)");
  for (const registration of preview.nativeRegistrations) {
    output.print(
      `  ${registration.toolId}: ${registration.binary} will be asked to unregister ${registration.pluginRefCount} plugin ref(s) and ${registration.marketplaceCount} marketplace(s)`
    );
    for (const cachePath of registration.cachePaths) {
      output.print(`    cache to purge once unregistered: ${cachePath}`);
    }
  }
  if (preview.sharedSourceOtherProjects !== undefined) {
    const otherProjects = preview.sharedSourceOtherProjects;
    const projects = otherProjects.length > 0 ? otherProjects.join(", ") : "no other project";
    output.print(`  aidd-framework: shared source, still referenced by: ${projects}`);
  }
}

export function printProjectCleanOutcome(
  output: Output,
  result: ProjectCleanResult,
  interactive: boolean
): void {
  if (!result.manifestFound) {
    output.success("Nothing to clean");
    return;
  }
  if (!result.dryRun) {
    output.success(`Cleaned all AIDD files (${result.fileCount} files removed)`);
    return;
  }
  printProjectPreview(output, result.preview);
  if (interactive) output.print("No files removed.");
  else output.success(wouldRemove(result.preview));
}

/** What a dry run says it would remove when nobody is there to confirm it. */
function wouldRemove({ totalFileCount, tools }: ProjectCleanResult["preview"]): string {
  const files = totalFileCount === 1 ? "file" : "files";
  return `Would remove ${totalFileCount} ${files} across ${tools.length} ${tools.length === 1 ? "tool" : "tools"}. Use --force to confirm.`;
}

/** Names what `--scope user` is about to purge before anything is removed: the shared
 * source's versions and the projects `references.json` names, existing paths only. */
function printUserScopePreview(output: Output, result: UserScopeCleanResult): void {
  const { preview } = result;
  output.print("The following will be removed for this machine:");
  for (const toolId of preview.toolIds) {
    output.print(`  ${toolId}: registration will be undone through its own CLI`);
  }
  const versions =
    preview.builtVersions.length > 0 ? preview.builtVersions.join(", ") : "none built yet";
  output.print(`  ${FRAMEWORK_MARKETPLACE_NAME}: shared source (versions: ${versions})`);
  const projects =
    preview.referencingProjects.length > 0
      ? preview.referencingProjects.join(", ")
      : "no other project";
  output.print(`  still referenced by: ${projects}`);
}

export function printUserScopeCleanOutcome(
  output: Output,
  result: UserScopeCleanResult,
  interactive: boolean
): void {
  if (result.dryRun) {
    printUserScopePreview(output, result);
    if (interactive) {
      output.print("No files removed.");
    } else {
      output.success("Use --force to confirm.");
    }
    return;
  }

  if (!result.manifestFound) {
    // The use case already logged that no user-scope manifest existed, so no host
    // registration was there to undo; this names the whitelist purge alone.
    output.success(`Purged the shared ${FRAMEWORK_MARKETPLACE_NAME} source's machine-local state`);
    return;
  }

  output.success(`Cleaned the shared ${FRAMEWORK_MARKETPLACE_NAME} source for this machine`);
}
