import { join } from "node:path";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { LocalIntegrationRemoval } from "../../../ports/project-integration-cleanup.js";
import { unlistRulesIn } from "../../materialize/listed-rules/list-placed-rules.js";
import type { AssertProjectPathWithinRoot } from "../../ownership/assert-project-path-within-root.use-case.js";

/** Takes a plugin's rules out of the file its tool reads guidance from, the team's own text
 * kept; the file itself goes when nothing else was in it. */
export class UnlistProjectRules {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly withinRoot: Pick<AssertProjectPathWithinRoot, "execute">
  ) {}

  async execute({ plugin, tool, projectRoot }: LocalIntegrationRemoval): Promise<void> {
    const index = tool.rulesIndex();
    const glob = index?.globOf(plugin.plugin.name) ?? null;
    if (index === null || glob === null) return;
    const path = join(projectRoot, index.relativePath);
    await this.withinRoot.execute(projectRoot, path);
    await unlistRulesIn(this.fs, path, { index, glob });
  }
}
