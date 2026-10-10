import {
  type BranchConfigBinding,
  type BranchSnapshot,
  snapshotKey,
} from "../../../src/contexts/telemetry/domain/branch-binding.js";
import {
  type CloneIdentity,
  cloneKey,
} from "../../../src/contexts/telemetry/domain/consent/clone-identity.js";
import type {
  ConsentEvent,
  ConsentRecords,
} from "../../../src/contexts/telemetry/domain/consent/consent-history.js";
import type {
  SessionCarry,
  SessionDeclaration,
  TaskDeclaration,
} from "../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import type { BindingSnapshotStore } from "../../../src/contexts/telemetry/domain/ports/bindings/binding-snapshot-store.js";
import type {
  BindingsLock,
  LockWait,
} from "../../../src/contexts/telemetry/domain/ports/bindings/bindings-lock.js";
import type { SessionBindingStore } from "../../../src/contexts/telemetry/domain/ports/bindings/session-binding-store.js";
import type { BranchBindingSource } from "../../../src/contexts/telemetry/domain/ports/branch-binding-source.js";
import type {
  BranchBindingStore,
  BranchHeads,
} from "../../../src/contexts/telemetry/domain/ports/branch-binding-store.js";
import type { ConsentHistory } from "../../../src/contexts/telemetry/domain/ports/consent-history.js";
import type { ConsentSource } from "../../../src/contexts/telemetry/domain/ports/consent-source.js";
import type { PersonIdentityStore } from "../../../src/contexts/telemetry/domain/ports/identity/person-identity-store.js";
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
import {
  type CloneConsentReading,
  type ConsentReading,
  consentValue,
} from "../../../src/contexts/telemetry/domain/telemetry-consent.js";
import type { TranscriptPosition } from "../../../src/contexts/telemetry/domain/transcript-position.js";
import { foldUsage } from "../../../src/contexts/telemetry/domain/usage-fold.js";

/** Transcripts held as lines; a position is the number of lines consumed. */
export class InMemoryTranscripts implements TranscriptSource {
  readonly files = new Map<string, string[]>();
  /** What a file reports besides how many lines it holds. */
  readonly stats = new Map<string, { size?: number; identity?: string }>();
  /** When each file was last written, if it matters to the test. */
  readonly modified = new Map<string, string>();

  async list(): Promise<readonly string[]> {
    return [...this.files.keys()].sort();
  }

  async oldestModified(paths: readonly string[]): Promise<string | null> {
    const times = paths.flatMap((path) => this.modified.get(path) ?? []).sort();
    return times[0] ?? null;
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
  /** Pass one array to several fakes to see the order they were used in. */
  constructor(readonly events: string[] = []) {}
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
    return {
      records: foldUsage(this.records),
      skippedLines: this.damaged.size,
      damagedMonths: new Set(this.damaged),
    };
  }

  /** Months whose partition holds a line that is not a record. */
  damaged = new Set<string>();
  savedMonths: ReadonlySet<string> | undefined;

  async save(records: readonly StoredUsage[], months?: ReadonlySet<string>): Promise<void> {
    this.events.push("save");
    this.savedMonths = months;
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

export class InMemoryBindingsLock implements BindingsLock {
  /** Pass one array to several fakes to see the order they were used in. */
  constructor(readonly events: string[] = []) {}

  /** The wait each use asked for: `undefined` is the lock's own. */
  readonly waits: (number | undefined)[] = [];

  async exclusively<T>(work: () => Promise<T>, wait?: LockWait): Promise<T> {
    this.waits.push(wait?.waitMs);
    this.events.push("bindings-lock");
    try {
      return await work();
    } finally {
      this.events.push("bindings-unlock");
    }
  }
}

/** A clone as the fakes know it: told from another at the same path by any of `overrides`. */
export function cloneOf(path: string, overrides: Partial<CloneIdentity> = {}): CloneIdentity {
  return { path, dev: "1", ino: "7", birthtimeMs: 1_000, ...overrides };
}

/** The token of the interval a test opens for `clone`: one per clone, since a token names one
 * interval. */
export function tokenOf(clone: CloneIdentity): string {
  return `token-${cloneKey(clone)}`;
}

/** What the clone's key holds once `on` has opened `clone`'s interval. */
export function grantedBy(clone: CloneIdentity): string {
  return consentValue(tokenOf(clone));
}

export class InMemoryConsentHistory implements ConsentHistory {
  readonly written: ConsentEvent[] = [];
  /** A line of the file was not an event. */
  damaged = false;

  async read(): Promise<ConsentRecords> {
    return { events: [...this.written], damaged: this.damaged };
  }

  async append(event: ConsentEvent): Promise<void> {
    this.written.push(event);
  }

  /** `clone` consented, since before any call there is. */
  consented(clone: CloneIdentity, at = "2026-01-01T00:00:00.000Z"): void {
    this.written.push({ kind: "open", token: tokenOf(clone), clone, at });
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
  /** The value of `aidd.telemetry` by root; a root with none has it unset. */
  readonly values = new Map<string, string>();
  /** Roots whose git config cannot be read. */
  readonly unreadable = new Set<string>();
  readonly reads: string[] = [];
  /** The value of `aidd.telemetry` by clone (`cloneKey`); a clone not listed has nothing at its
   * path, one mapped to `null` has the key unset. */
  readonly clones = new Map<string, string | null>();
  /** Clones with another directory at their path now, by `cloneKey`. */
  readonly replacedClones = new Set<string>();
  readonly cloneReads: string[] = [];
  /** Clones whose git config cannot be read, by `cloneKey`. */
  readonly unreadableClones = new Set<string>();

  /** Says what `clone` holds now. */
  cloneSays(clone: CloneIdentity, value: string | null): void {
    this.clones.set(cloneKey(clone), value);
  }

  async readClone(clone: CloneIdentity): Promise<CloneConsentReading> {
    this.cloneReads.push(clone.path);
    const key = cloneKey(clone);
    if (this.unreadableClones.has(key)) return { kind: "unreadable" };
    if (this.replacedClones.has(key)) return { kind: "replaced" };
    const value = this.clones.get(key);
    return value === undefined ? { kind: "absent" } : { kind: "value", value };
  }

  async read(root: string): Promise<ConsentReading> {
    this.reads.push(root);
    if (this.unreadable.has(root)) return { kind: "unreadable" };
    return { kind: "value", value: this.values.get(root) ?? null };
  }
}

export class FakeBindings implements BranchBindingSource {
  bindingsByRoot = new Map<string, BranchConfigBinding[]>();
  creation = new Map<string, string | null>();
  reflogReads = 0;
  /** Pass one array to several fakes to see the order they were used in. */
  constructor(readonly events: string[] = []) {}

  async bindings(root: string): Promise<readonly BranchConfigBinding[]> {
    this.events.push("read-config");
    return this.bindingsByRoot.get(root) ?? [];
  }

  async createdAt(_root: string, branch: string): Promise<string | null> {
    this.reflogReads += 1;
    return this.creation.get(branch) ?? null;
  }
}

export class InMemorySnapshots implements BindingSnapshotStore {
  constructor(readonly events: string[] = []) {}
  readonly appended: BranchSnapshot[] = [];
  latestReads = 0;
  appendCalls = 0;

  async latest(): Promise<ReadonlyMap<string, BranchSnapshot>> {
    this.latestReads += 1;
    return new Map(this.appended.map((s) => [snapshotKey(s.repository_id, s.branch), s]));
  }

  async history(): Promise<ReadonlyMap<string, readonly BranchSnapshot[]>> {
    const history = new Map<string, BranchSnapshot[]>();
    for (const s of this.appended) {
      const key = snapshotKey(s.repository_id, s.branch);
      history.set(key, [...(history.get(key) ?? []), s]);
    }
    return history;
  }

  async append(snapshots: readonly BranchSnapshot[]): Promise<void> {
    this.appendCalls += 1;
    this.events.push("snapshot");
    this.appended.push(...snapshots);
  }
}

export class FakeBranchStore implements BranchBindingStore {
  heads_: BranchHeads = { head: "refs/heads/feat/x", originHead: null };
  readonly declared: { root: string; branch: string; declaration: TaskDeclaration }[] = [];

  constructor(readonly events: string[] = []) {}

  async heads(): Promise<BranchHeads> {
    return this.heads_;
  }

  async declare(root: string, branch: string, declaration: TaskDeclaration): Promise<void> {
    this.events.push("declare");
    this.declared.push({ root, branch, declaration });
  }
}

export class InMemorySessions implements SessionBindingStore {
  readonly lines: SessionDeclaration[] = [];
  readonly carried: SessionCarry[] = [];

  constructor(readonly events: string[] = []) {}

  async append(sessionId: string, declaration: TaskDeclaration): Promise<void> {
    this.events.push("append");
    this.lines.push({ session_id: sessionId, ...declaration });
  }

  async declarations(): Promise<readonly SessionDeclaration[]> {
    return [...this.lines];
  }

  async carries(): Promise<readonly SessionCarry[]> {
    return [...this.carried];
  }
}

export class InMemoryIdentity implements PersonIdentityStore {
  personId: string | null = null;
  writes = 0;

  async read(): Promise<string | null> {
    return this.personId;
  }

  async write(personId: string): Promise<void> {
    this.writes += 1;
    this.personId = personId;
  }

  async remove(): Promise<boolean> {
    const held = this.personId !== null;
    this.personId = null;
    return held;
  }
}
