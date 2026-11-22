import { join } from "node:path";
import type { Environment } from "../../../../shared/ports/environment.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { AgentModelAnswers } from "../../../tools/contract/tool-profile.js";
import type { AgentModelSection } from "../../ports/tool-sections.js";

/** What a host answers about its main session: the models it can run, and the settings file
 * that holds the choice. */
export interface MainSessionLocation {
  readonly models: AgentModelAnswers | null;
  readonly path: string | undefined;
}

/** What LocateMainSession is built from. */
export interface LocateMainSessionDeps {
  readonly fs: FileReader;
  readonly homedir: () => string;
  readonly environment: Environment;
}

/** Where a host's main session reads its model, and what that host answers about its models. */
export class LocateMainSession {
  constructor(
    private readonly deps: LocateMainSessionDeps,
    private readonly tools: ToolCatalog
  ) {}

  /** The host's models and the file its main session reads. Both absent for a host aidd does not
   * drive; the path alone absent where aidd leaves the main session alone. */
  async execute(host: string): Promise<MainSessionLocation> {
    const id = this.tools.aiToolId(host);
    if (id === null) return { models: null, path: undefined };
    const profile = this.tools.aiProfile(id);
    return { models: profile.agentModels(), path: await this.settingsPath(profile) };
  }

  /** The tool's own user settings file; a tool declaring none there reads its main settings
   * file, a JSONC file that outranks its JSON twin, from the directory a machine-wide install
   * copies its files into. The twin is used only when it alone exists. Absent where neither
   * exists, or where aidd leaves the main session alone. */
  private async settingsPath(profile: AgentModelSection): Promise<string | undefined> {
    const settings = profile.agentModels()?.mainSettings() ?? null;
    if (settings === null) return undefined;
    const home = this.deps.homedir();
    const own = profile
      .nativeActivation()
      ?.userSettingsFile(home, (name) => this.deps.environment.get(name));
    if (own !== undefined) return own;
    const globalDir = profile.plugins()?.globalFiles()?.dir(home);
    // No registered tool reaches this: each one with main settings declares a user settings file
    // or a plugin directory. Kept as a known mutation survivor.
    if (globalDir === undefined) return undefined;
    const path = join(globalDir, settings.file);
    const twin = path.replace(/c$/, "");
    return !(await this.deps.fs.fileExists(path)) && (await this.deps.fs.fileExists(twin))
      ? twin
      : path;
  }
}
