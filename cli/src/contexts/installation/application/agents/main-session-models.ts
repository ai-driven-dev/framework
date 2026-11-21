import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { AgentModelStore } from "../../ports/agent-model-store.js";
import type { MainSessionSettings } from "../../ports/main-session-settings.js";
import type { MainSessionLocator } from "./main-session-locator.js";

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

export interface MainSessionModelsRequest {
  readonly hosts: readonly string[];
  readonly chosen: ReadonlyMap<string, string>;
  /** Says what it would change and changes nothing. */
  readonly dryRun?: boolean;
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
    private readonly mainSessionLocator: Pick<MainSessionLocator, "locate">
  ) {}

  /** Points each host's main session at its chosen provider, or restores what it replaced once
   * none is chosen. A settings file it cannot safely rewrite is skipped, never half-written.
   * `dryRun` says what it would change and changes nothing. */
  async execute({
    hosts,
    chosen,
    dryRun = false,
  }: MainSessionModelsRequest): Promise<MainSessionOutcome> {
    const mainModels = await this.store.loadMainModels();
    const changes: FileChange[] = [];
    const skipped: MainSessionSkip[] = [];
    for (const host of hosts) {
      const provider = chosen.get(host);
      const record = mainModels[host];
      const { models, path: current } = await this.mainSessionLocator.locate(host);
      // Restored where it was written, once unset or once the host reads another file.
      if (record !== undefined && (provider === undefined || record.path !== current)) {
        try {
          const content = await this.readIfAny(record.path);
          const next = this.settings.planRemoval(content, record);
          delete mainModels[host];
          if (next !== content) changes.push({ host, path: record.path, content: next });
        } catch (error) {
          skipped.push({ host, path: record.path, reason: (error as Error).message });
          continue;
        }
      }
      if (provider === undefined || current === undefined || models === null) continue;
      try {
        const plan = this.settings.planInstall({
          path: current,
          content: await this.readIfAny(current),
          values: models.mainSettingsValues(provider),
          record: mainModels[host],
          schema: models.mainSettings()?.schema,
        });
        mainModels[host] = plan.record;
        changes.push({ host, path: current, content: plan.content });
      } catch (error) {
        skipped.push({ host, path: current, reason: (error as Error).message });
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

  private async readIfAny(path: string): Promise<string | null> {
    return (await this.fs.fileExists(path)) ? this.fs.readFile(path) : null;
  }
}
