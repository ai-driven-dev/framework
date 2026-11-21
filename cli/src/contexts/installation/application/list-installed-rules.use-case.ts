import { join } from "node:path";
import { posixRelative } from "../../../shared/domain/paths.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../tools/contract/tool-catalog.js";
import type { InstalledRule } from "../contract/installed-rule.js";
import { toInstalledRule } from "../domain/installed-rule.js";

export interface ListInstalledRulesRequest {
  readonly projectRoot: string;
}

export interface ListInstalledRulesResult {
  readonly rules: readonly InstalledRule[];
}

/** `/`-separated whatever the platform hands back, because the path is data a caller reads
 * and compares, not a path it opens. A Windows checkout answering `.claude\rules\a.md`
 * would make the same project's rules read differently on two machines. */
function projectRelative(projectRoot: string, absolutePath: string, platform: string): string {
  return posixRelative(projectRoot, absolutePath, platform);
}

/**
 * Every rule installed in a project, across every tool that installs any. Asking each tool where it
 * installs is what makes a fifth tool, or a moved directory, impossible to miss.
 */
export class ListInstalledRules {
  constructor(
    private readonly files: FileReader,
    private readonly platform: string,
    private readonly tools: ToolCatalog
  ) {}

  async execute(input: ListInstalledRulesRequest): Promise<ListInstalledRulesResult> {
    const rules: InstalledRule[] = [];
    for (const toolId of this.tools.idsInCanonicalOrder("ai")) {
      const location = this.tools.aiProfile(toolId).installedRulesLocation();
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
        toInstalledRule({
          tool: toolId,
          path: projectRelative(projectRoot, file, this.platform),
          extension: location.extension,
          content,
        })
      );
    }
    return rules;
  }
}
