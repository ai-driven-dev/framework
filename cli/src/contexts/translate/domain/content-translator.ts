import { InstallationFile } from "../../../shared/domain/file.js";
import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import type { Hasher } from "../../../shared/ports/hasher.js";
import type { ToolProfile } from "../../tools/contract/tool-profile.js";
import { PluginContentEngine } from "./engine.js";

/** The hashed face of the engine, for the two installation commands that still translate in
 * place. Goes with them when translation moves to orchestration. */
export class PluginContentTranslator {
  private readonly engine = new PluginContentEngine();

  constructor(private readonly hasher: Hasher) {}

  translate(dist: PluginDistribution, tool: ToolProfile): InstallationFile[] {
    return this.translateWithComponentPaths(dist, tool).files;
  }

  flatHookPaths(dist: PluginDistribution, tool: ToolProfile): ReadonlySet<string> {
    return this.engine.flatHookPaths(dist, tool);
  }

  translateWithComponentPaths(dist: PluginDistribution, tool: ToolProfile) {
    const { files, ...rest } = this.engine.translateWithComponentPaths(dist, tool);
    return {
      ...rest,
      files: files.map(
        ({ relativePath, content }) =>
          new InstallationFile({ relativePath, content, hash: this.hasher.hash(content) })
      ),
    };
  }
}
