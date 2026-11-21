import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { AgentModelStore, MainModels } from "../../ports/agent-model-store.js";
import type { MainModelRecord, MainSessionSettings } from "../../ports/main-session-settings.js";
import type { MainSessionLocation, MainSessionLocator } from "./main-session-locator.js";

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

/** What planning one host decided: a settings change, or why it was skipped. */
interface PlannedChange {
  change?: FileChange;
  skip?: MainSessionSkip;
}

/** One host's turn: the provider chosen for it, and the record of what aidd replaced. */
interface HostRun {
  host: string;
  provider: string | undefined;
  mainModels: MainModels;
}

/** What MainSessionModels is built from. */
export interface MainSessionModelsDeps {
  readonly fs: FileReader & FileWriter;
  readonly store: AgentModelStore;
  readonly settings: MainSessionSettings;
  readonly mainSessionLocator: Pick<MainSessionLocator, "locate">;
}

/**
 * Points each tool's main session at its provider's main-tier model in the tool's own user
 * settings, machine-wide like the provider and never a file a project tracks, recording what that
 * replaced so unsetting restores it.
 */
export class MainSessionModels {
  constructor(private readonly deps: MainSessionModelsDeps) {}

  /** Points each host's main session at its chosen provider, or restores what it replaced once
   * none is chosen. A settings file it cannot safely rewrite is skipped, never half-written.
   * `dryRun` says what it would change and changes nothing. */
  async execute({
    hosts,
    chosen,
    dryRun = false,
  }: MainSessionModelsRequest): Promise<MainSessionOutcome> {
    const mainModels = await this.deps.store.loadMainModels();
    const changes: FileChange[] = [];
    const skipped: MainSessionSkip[] = [];
    for (const host of hosts) {
      const planned = await this.planHost({ host, provider: chosen.get(host), mainModels });
      changes.push(...planned.changes);
      skipped.push(...planned.skipped);
    }
    const outcome = { changed: changes.map(({ host, path }) => ({ host, path })), skipped };
    if (dryRun) return outcome;
    // The record goes first: a run stopped between two settings files still knows what each
    // held before, so unsetting restores it instead of taking aidd's value for the person's.
    await this.deps.store.saveMainModels(mainModels);
    for (const { path, content } of changes) {
      if (content === null) await this.deps.fs.deleteFile(path);
      else await this.deps.fs.writeFile(path, content);
    }
    return outcome;
  }

  private async planHost(
    run: HostRun
  ): Promise<{ changes: FileChange[]; skipped: MainSessionSkip[] }> {
    const located = await this.deps.mainSessionLocator.locate(run.host);
    const restored = await this.restoreStale(run, located.path);
    if (restored.skip !== undefined) return { changes: [], skipped: [restored.skip] };
    const installed = await this.install(run, located);
    return {
      changes: [restored.change, installed.change].filter((change) => change !== undefined),
      skipped: installed.skip === undefined ? [] : [installed.skip],
    };
  }

  /** Restored where it was written, once unset or once the host reads another file. */
  private async restoreStale(
    { host, provider, mainModels }: HostRun,
    current: string | undefined
  ): Promise<PlannedChange> {
    const record = mainModels[host];
    if (record === undefined || (provider !== undefined && record.path === current)) return {};
    return this.restore(host, record, mainModels);
  }

  private async install(
    { host, provider, mainModels }: HostRun,
    { models, path }: MainSessionLocation
  ): Promise<PlannedChange> {
    if (provider === undefined || path === undefined || models === null) return {};
    try {
      const plan = this.deps.settings.planInstall({
        path,
        content: await this.readIfAny(path),
        values: models.mainSettingsValues(provider),
        record: mainModels[host],
        schema: models.mainSettings()?.schema,
      });
      mainModels[host] = plan.record;
      return { change: { host, path, content: plan.content } };
    } catch (error) {
      return { skip: { host, path, reason: (error as Error).message } };
    }
  }

  private async restore(
    host: string,
    record: MainModelRecord,
    mainModels: MainModels
  ): Promise<PlannedChange> {
    try {
      const content = await this.readIfAny(record.path);
      const next = this.deps.settings.planRemoval(content, record);
      delete mainModels[host];
      return next === content ? {} : { change: { host, path: record.path, content: next } };
    } catch (error) {
      return { skip: { host, path: record.path, reason: (error as Error).message } };
    }
  }

  private async readIfAny(path: string): Promise<string | null> {
    return (await this.deps.fs.fileExists(path)) ? this.deps.fs.readFile(path) : null;
  }
}
