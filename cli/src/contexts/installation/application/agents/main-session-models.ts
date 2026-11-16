import { join } from "node:path";
import type { Environment } from "../../../../shared/ports/environment.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { AgentModelStore } from "../../ports/agent-model-store.js";
import type { MainSessionSettings } from "../../ports/main-session-settings.js";

/** A tool whose main session's settings file a run changed, and that file. */
export interface MainSessionChange {
  readonly host: string;
  readonly path: string;
}

/** A tool whose settings file was left as it is, and why. */
export interface MainSessionSkip extends MainSessionChange {
  readonly reason: string;
}

export interface MainSessionOutcome {
  readonly changed: readonly MainSessionChange[];
  readonly skipped: readonly MainSessionSkip[];
}

interface FileChange extends MainSessionChange {
  readonly content: string | null;
}

/**
 * Points each tool's main session at its provider's main-tier model in the tool's own user
 * settings, machine-wide like the provider and never a file a project tracks, recording what that
 * replaced so unsetting restores it.
 */
export class MainSessionModels {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly store: AgentModelStore,
    private readonly settings: MainSessionSettings,
    private readonly homedir: () => string,
    private readonly environment: Environment
  ) {}

  /** Points each host's main session at its chosen provider, or restores what it replaced once
   * none is chosen. A settings file it cannot safely rewrite is skipped, never half-written.
   * `dryRun` says what it would change and changes nothing. */
  async apply(
    tools: ToolCatalog,
    hosts: readonly string[],
    chosen: ReadonlyMap<string, string>,
    dryRun = false
  ): Promise<MainSessionOutcome> {
    const mainModels = await this.store.loadMainModels();
    const changes: FileChange[] = [];
    const skipped: MainSessionSkip[] = [];
    for (const host of hosts) {
      const provider = chosen.get(host);
      const record = mainModels[host];
      const profile = this.profileOf(tools, host);
      const current = profile === null ? undefined : await this.settingsPath(profile);
      let path = record?.path ?? current;
      try {
        // Restored where it was written, once unset or once the host reads another file.
        if (record !== undefined && (provider === undefined || record.path !== current)) {
          const content = await this.readIfAny(record.path);
          const next = this.settings.planRemoval(content, record);
          delete mainModels[host];
          if (next !== content) changes.push({ host, path: record.path, content: next });
        }
        const models = profile?.agentModels() ?? null;
        if (provider === undefined || current === undefined || models === null) continue;
        path = current;
        const plan = this.settings.planInstall(
          current,
          await this.readIfAny(current),
          models.mainSettingsValues(provider),
          mainModels[host],
          models.mainSettings()?.schema
        );
        mainModels[host] = plan.record;
        changes.push({ host, path: current, content: plan.content });
      } catch (error) {
        if (path !== undefined) skipped.push({ host, path, reason: (error as Error).message });
      }
    }
    const outcome = { changed: changes.map(({ host, path }) => ({ host, path })), skipped };
    if (dryRun) return outcome;
    // The record goes first: a run stopped between two settings files still knows what each
    // held before, so unsetting restores it instead of taking aidd's value for the person's.
    await this.store.saveMainModels(mainModels);
    for (const { path, content } of changes) {
      if (content === null) await this.fs.deleteFile(path);
      else await this.fs.writeFile(path, content);
    }
    return outcome;
  }

  /** Restores what every main session held before its model was set. */
  async restoreAll(tools: ToolCatalog, dryRun: boolean): Promise<MainSessionOutcome> {
    const hosts = Object.keys(await this.store.loadMainModels());
    return this.apply(tools, hosts, new Map(), dryRun);
  }

  private profileOf(tools: ToolCatalog, host: string): AiToolProfile | null {
    const id = tools.aiToolId(host);
    return id === null ? null : tools.aiProfile(id);
  }

  private async readIfAny(path: string): Promise<string | null> {
    return (await this.fs.fileExists(path)) ? this.fs.readFile(path) : null;
  }

  /** The tool's own user settings file; a tool declaring none there reads its main settings
   * file, a JSONC file that outranks its JSON twin, from the directory a machine-wide install
   * copies its files into. The twin is used only when it alone exists. Absent where neither
   * exists, or where aidd leaves the main session alone. */
  private async settingsPath(profile: AiToolProfile): Promise<string | undefined> {
    const settings = profile.agentModels()?.mainSettings() ?? null;
    if (settings === null) return undefined;
    const home = this.homedir();
    const own = profile
      .nativeActivation()
      ?.userSettingsFile(home, (name) => this.environment.get(name));
    if (own !== undefined) return own;
    const globalDir = profile.plugins()?.globalFiles()?.dir(home);
    if (globalDir === undefined) return undefined;
    const path = join(globalDir, settings.file);
    const twin = path.replace(/c$/, "");
    return !(await this.fs.fileExists(path)) && (await this.fs.fileExists(twin)) ? twin : path;
  }
}
