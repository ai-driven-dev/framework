import { join } from "node:path";
import { whenAbsent } from "../../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { LocalIntegrationRemoval } from "../../../ports/project-integration-cleanup.js";
import type { AssertProjectPathWithinRoot } from "../../ownership/assert-project-path-within-root.use-case.js";

/** Takes a plugin's rules out of the file its tool reads guidance from, the team's own text
 * kept; the file itself goes when nothing else was in it. */
export class UnlistProjectRules {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly withinRoot: Pick<AssertProjectPathWithinRoot, "execute">
  ) {}

  async execute({ plugin, tool, projectRoot }: LocalIntegrationRemoval): Promise<void> {
    const index = tool.flatRulesIndex();
    const glob = tool.flatRulesPlacement(plugin.plugin.name)?.glob;
    if (index === null || glob === undefined) return;
    const path = join(projectRoot, index.relativePath);
    await this.withinRoot.execute(projectRoot, path);
    const existing = await whenAbsent(() => this.fs.readFile(path), undefined);
    if (existing === undefined) return;
    const content = index.withoutGlob(existing, glob);
    if (content === existing) return;
    if (content === "") await this.fs.deleteFile(path);
    else await this.fs.writeFile(path, content);
  }
}
