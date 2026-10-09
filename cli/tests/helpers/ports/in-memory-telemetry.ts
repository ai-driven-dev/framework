import {
  type BranchConfigBinding,
  type BranchSnapshot,
  snapshotKey,
} from "../../../src/contexts/telemetry/domain/branch-binding.js";
import type { BindingSnapshotStore } from "../../../src/contexts/telemetry/domain/ports/binding-snapshot-store.js";
import type { BranchBindingSource } from "../../../src/contexts/telemetry/domain/ports/branch-binding-source.js";
import type { ConsentSource } from "../../../src/contexts/telemetry/domain/ports/consent-source.js";
import type {
  LocatedDirectory,
  RepositoryLocator,
} from "../../../src/contexts/telemetry/domain/ports/repository-locator.js";
import type { ResolutionStore } from "../../../src/contexts/telemetry/domain/ports/resolution-store.js";
import type {
  TranscriptRead,
  TranscriptSource,
} from "../../../src/contexts/telemetry/domain/ports/transcript-source.js";
import type {
  LoadedLedger,
  UsageLedger,
} from "../../../src/contexts/telemetry/domain/ports/usage-ledger.js";
import type { RepositoryResolution } from "../../../src/contexts/telemetry/domain/repository-resolution.js";
import type { StoredUsage } from "../../../src/contexts/telemetry/domain/stored-usage.js";
import type { TranscriptPosition } from "../../../src/contexts/telemetry/domain/transcript-position.js";
import { foldUsage } from "../../../src/contexts/telemetry/domain/usage-fold.js";

/** Transcripts held as lines; a position is the number of lines consumed. */
export class InMemoryTranscripts implements TranscriptSource {
  readonly files = new Map<string, string[]>();
  /** What a file reports besides how many lines it holds. */
  readonly stats = new Map<string, { size?: number; identity?: string }>();

  async list(): Promise<readonly string[]> {
    return [...this.files.keys()].sort();
  }

  async read(path: string, since: TranscriptPosition | null): Promise<TranscriptRead> {
    const all = this.files.get(path) ?? [];
    const from = since?.offset ?? 0;
    return {
      lines: all.slice(from),
      position: {
        offset: all.length,
        size: this.stats.get(path)?.size ?? all.length,
        identity: this.stats.get(path)?.identity ?? "inode",
      },
      restarted: false,
    };
  }
}

export class InMemoryLedger implements UsageLedger {
  records: StoredUsage[] = [];
  stored = new Map<string, TranscriptPosition>();
  readonly events: string[] = [];
  failSave = false;
  exclusiveRuns = 0;

  async exclusively<T>(work: () => Promise<T>): Promise<T> {
    this.exclusiveRuns += 1;
    this.events.push("lock");
    try {
      return await work();
    } finally {
      this.events.push("unlock");
    }
  }

  async load(): Promise<LoadedLedger> {
    this.events.push("load");
    return { records: foldUsage(this.records), skippedLines: 0 };
  }

  async save(records: readonly StoredUsage[]): Promise<void> {
    this.events.push("save");
    if (this.failSave) throw new Error("disk full");
    this.records = [...records];
  }

  async positions(): Promise<ReadonlyMap<string, TranscriptPosition>> {
    return new Map(this.stored);
  }

  async savePositions(positions: ReadonlyMap<string, TranscriptPosition>): Promise<void> {
    this.events.push("positions");
    this.stored = new Map(positions);
  }
}

export class InMemoryResolutions implements ResolutionStore {
  resolutions = new Map<string, RepositoryResolution>();
  saves = 0;

  async load(): Promise<Map<string, RepositoryResolution>> {
    return new Map(this.resolutions);
  }

  async save(resolutions: ReadonlyMap<string, RepositoryResolution>): Promise<void> {
    this.saves += 1;
    this.resolutions = new Map(resolutions);
  }
}

export class FakeLocator implements RepositoryLocator {
  readonly directories = new Map<string, LocatedDirectory>();
  readonly asked: string[] = [];

  async locate(cwd: string): Promise<LocatedDirectory> {
    this.asked.push(cwd);
    return this.directories.get(cwd) ?? { status: "gone" };
  }
}

export class FakeConsents implements ConsentSource {
  readonly texts = new Map<string, string>();
  readonly reads: string[] = [];

  async read(root: string): Promise<string | null> {
    this.reads.push(root);
    return this.texts.get(root) ?? null;
  }
}

export class FakeBindings implements BranchBindingSource {
  bindingsByRoot = new Map<string, BranchConfigBinding[]>();
  creation = new Map<string, string | null>();
  reflogReads = 0;

  async bindings(root: string): Promise<readonly BranchConfigBinding[]> {
    return this.bindingsByRoot.get(root) ?? [];
  }

  async createdAt(_root: string, branch: string): Promise<string | null> {
    this.reflogReads += 1;
    return this.creation.get(branch) ?? null;
  }
}

export class InMemorySnapshots implements BindingSnapshotStore {
  readonly appended: BranchSnapshot[] = [];
  latestReads = 0;
  appendCalls = 0;

  async latest(): Promise<ReadonlyMap<string, BranchSnapshot>> {
    this.latestReads += 1;
    return new Map(this.appended.map((s) => [snapshotKey(s.repository_id, s.branch), s]));
  }

  async append(snapshots: readonly BranchSnapshot[]): Promise<void> {
    this.appendCalls += 1;
    this.appended.push(...snapshots);
  }
}
