import { join } from "node:path";
import { posixRelative } from "../../../kernel/paths.js";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { AiToolId } from "../../../kernel/tool.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { InstalledRule } from "../domain/installed-rule.js";
import { toInstalledRule } from "../domain/installed-rule.js";

export interface ListInstalledRulesInput {
  readonly projectRoot: string;
  readonly tools: ToolCatalog;
}

export interface ListInstalledRulesResult {
  readonly rules: readonly InstalledRule[];
}

/** `/`-separated whatever the platform hands back, because the path is data a caller reads
 * and compares, not a path it opens. A Windows checkout answering `.claude\rules\a.md`
 * would make the same project's rules read differently on two machines. */
function projectRelative(projectRoot: string, absolutePath: string): string {
  return posixRelative(projectRoot, absolutePath);
}

/**
 * Every rule installed in a project, across every tool that installs any. Asking each tool where it
 * installs is what makes a fifth tool, or a moved directory, impossible to miss.
 */
export class ListInstalledRulesUseCase {
  constructor(private readonly files: FileReader) {}

  async execute(input: ListInstalledRulesInput): Promise<ListInstalledRulesResult> {
    const rules: InstalledRule[] = [];
    for (const toolId of input.tools.aiIdsInCanonicalOrder()) {
      const location = input.tools.aiProfile(toolId).installedRulesLocation();
      if (location === null) continue;
      rules.push(...(await this.rulesUnder(input.projectRoot, toolId, location)));
    }
    return { rules };
  }

  /** A directory that is not there yields nothing: `listFilesRecursive` answers an empty
   * list for one it cannot read, so a project with a single tool installed is the ordinary
   * case here and not a branch. */
  private async rulesUnder(
    projectRoot: string,
    toolId: AiToolId,
    location: { directory: string; extension: string }
  ): Promise<readonly InstalledRule[]> {
    const absolute = join(projectRoot, location.directory);
    const found = await this.files.listFilesRecursive(absolute);
    const rules: InstalledRule[] = [];
    for (const file of found.filter((path) => path.endsWith(location.extension))) {
      const content = await this.files.readFile(file);
      rules.push(
        toInstalledRule(toolId, projectRelative(projectRoot, file), location.extension, content)
      );
    }
    return rules;
  }
}
