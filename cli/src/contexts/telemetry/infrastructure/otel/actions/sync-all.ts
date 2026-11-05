import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { asPlainObject } from "../../../../../kernel/reading/plain-object.js";
import {
  type SessionAdmission,
  type SessionFeature,
  sameSessionAdmission,
  sameSessionFeature,
} from "../../../domain/report/session-feature.js";
import { LedgerLock } from "../../ledger-lock.js";
import { CODEX_CONFIG_ID } from "../settings.js";
import { createSessionProjectPublisher } from "./metadata/session-project.js";
import { createSessionRepositoryPublisher } from "./metadata/session-repository.js";
import { createSessionTitlePublisher } from "./metadata/session-title.js";
import {
  admissionFingerprint,
  type BindingDetails,
  bindingTransfer,
  ConsentNotConfirmedError,
  destination,
  evidenceTransfers,
  type Identity,
  type IdentityEvidence,
  OtelObservationTooLargeError,
  observeIdentity,
  packTransfers,
  readBindingDetails,
  type SyncOptions,
  saveBindingState,
  selectTransfers,
  send,
  sessionIdsInCapture,
  type Transfer,
} from "./sync.js";

export type AllOptions = Omit<SyncOptions, "session" | "follow" | "stateDir" | "titlesOnly"> & {
  readonly stateDir: string;
  readonly refreshMs?: number;
};
type Consent = "allow" | "deny" | "unknown";
type Snapshot = ReadonlyMap<string, SessionAdmission>;
interface Pending {
  readonly offset: number;
  readonly length: number;
  /** This range was admitted but could not be delivered; preserve it even if later denied. */
  readonly hold?: boolean;
  readonly admissionKey?: string;
  readonly cwdKey?: string;
  readonly cloneKey?: string;
}
interface SessionState {
  readonly identity: Identity;
  readonly identityEvidence: IdentityEvidence[];
  identityAdmissionKey: string | null;
  identityAdmission: SessionAdmission | null;
  identityCloneKey: string | null;
  previousLinkUnverified: boolean;
  savedIdentity: BindingDetails | null;
  mayHaveLinked: boolean;
  binding: string;
  needsReplay: boolean;
}
interface Checkpoint {
  readonly device: number;
  readonly inode: number;
  readonly offset: number;
}
const MAX_LINE = 32 * 1024 * 1024;
const INTERVAL_MS = 5000;
const RETRY_MS = 30_000;
const BINDING_REFRESH_MS = 60_000;

function key(options: AllOptions, session: string) {
  return createHash("sha256")
    .update(`${options.endpoint}\0${options.tenant}\0${options.config}\0${session}`)
    .digest("hex");
}
function asOptions(options: AllOptions, session: string): SyncOptions {
  return { ...options, session, follow: true };
}
function admissionKey(admission: SessionAdmission): string {
  return admissionFingerprint(admission);
}
function cwdKey(cwd: string): string {
  return createHash("sha256").update(cwd).digest("hex");
}
async function privateDirectory(path: string) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const info = await lstat(path);
  if (!info.isDirectory() || (info.mode & 0o077) !== 0)
    throw new Error("Sync state directory must be private.");
}
async function readCheckpoint(path: string): Promise<Checkpoint | null> {
  const file = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  ).catch((error) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  });
  if (!file) return null;
  try {
    const info = await file.stat();
    if (!info.isFile() || (info.mode & 0o077) !== 0)
      throw new Error("Sync checkpoint must be a private regular file.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.readFile("utf8"));
    } catch {
      throw new Error("Sync checkpoint is invalid.");
    }
    const record = asPlainObject(parsed);
    if (
      !record ||
      !Number.isSafeInteger(record.device) ||
      !Number.isSafeInteger(record.inode) ||
      !Number.isSafeInteger(record.offset) ||
      Number(record.offset) < 0
    ) {
      throw new Error("Sync checkpoint is invalid.");
    }
    return {
      device: Number(record.device),
      inode: Number(record.inode),
      offset: Number(record.offset),
    };
  } finally {
    await file.close();
  }
}
async function saveCheckpoint(path: string, value: Checkpoint) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

function pendingLine(item: Pending): string {
  if (item.hold && !item.admissionKey) throw new Error("Sync pending admission is unavailable.");
  return `${item.offset} ${item.length}${item.hold ? ` hold ${item.admissionKey}${item.cwdKey && item.cloneKey ? ` ${item.cwdKey} ${item.cloneKey}` : ""}` : ""}\n`;
}

/** A pending journal contains only byte ranges, not source text or provider identities. */
async function appendPending(path: string, item: Pending) {
  const file = await open(
    path,
    constants.O_RDWR | constants.O_CREAT | constants.O_APPEND | constants.O_NOFOLLOW,
    0o600
  );
  try {
    const info = await file.stat();
    if (!info.isFile() || (info.mode & 0o077) !== 0)
      throw new Error("Sync pending journal must be a private regular file.");
    if (info.size > 0) {
      const length = Math.min(info.size, 256);
      const tail = Buffer.alloc(length);
      const { bytesRead } = await file.read(tail, 0, length, info.size - length);
      if (bytesRead !== length) throw new Error("Sync pending journal changed unexpectedly.");
      if (tail.at(-1) !== 10) {
        const last = tail.lastIndexOf(10);
        if (last < 0 && info.size > length)
          throw new Error("Sync pending journal has an invalid entry.");
        await file.truncate(last < 0 ? 0 : info.size - length + last + 1);
      }
    }
    await file.writeFile(pendingLine(item));
    await file.sync();
  } finally {
    await file.close();
  }
}

async function pendingRanges(path: string): Promise<Pending[]> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await file.stat();
    if (!info.isFile() || (info.mode & 0o077) !== 0)
      throw new Error("Sync pending journal must be a private regular file.");
    const ranges = new Map<string, Pending>();
    const contents = await file.readFile("utf8");
    const lines = contents.split("\n");
    lines.pop(); // A crash can leave an incomplete last append; its source line is replayed.
    for (const line of lines) {
      const parts =
        /^(\d+) (\d+)(?: hold ([a-f0-9]{64})(?: ([a-f0-9]{64}) ([a-f0-9]{64}))?)?$/.exec(line);
      if (!parts) throw new Error("Sync pending journal is invalid.");
      const offset = Number(parts[1]);
      const length = Number(parts[2]);
      if (
        !Number.isSafeInteger(offset) ||
        !Number.isSafeInteger(length) ||
        length < 1 ||
        length > MAX_LINE
      )
        throw new Error("Sync pending journal is invalid.");
      const rangeKey = `${offset} ${length}`;
      const previous = ranges.get(rangeKey);
      if (previous?.admissionKey && parts[3] && previous.admissionKey !== parts[3])
        throw new Error("Sync pending journal has conflicting admissions.");
      if (
        (previous?.cwdKey && parts[4] && previous.cwdKey !== parts[4]) ||
        (previous?.cloneKey && parts[5] && previous.cloneKey !== parts[5])
      )
        throw new Error("Sync pending journal has conflicting clone proofs.");
      ranges.set(rangeKey, {
        offset,
        length,
        hold: !!parts[3] || previous?.hold,
        admissionKey: parts[3] ?? previous?.admissionKey,
        cwdKey: parts[4] ?? previous?.cwdKey,
        cloneKey: parts[5] ?? previous?.cloneKey,
      });
    }
    return [...ranges.values()];
  } finally {
    await file.close();
  }
}

async function replacePending(path: string, ranges: readonly Pending[]) {
  if (ranges.length === 0) {
    await rm(path, { force: true });
    return;
  }
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, "wx", 0o600);
    try {
      await file.writeFile(ranges.map(pendingLine).join(""));
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** On first launch start at the last complete line. A line being appended is retained. */
async function initialOffset(
  file: Awaited<ReturnType<typeof open>>,
  size: number
): Promise<number> {
  if (size === 0) return 0;
  const limit = Math.min(size, MAX_LINE);
  const tail = Buffer.alloc(limit);
  const { bytesRead } = await file.read(tail, 0, limit, size - limit);
  if (bytesRead !== limit) throw new Error("Capture changed while sync was starting.");
  const last = tail.lastIndexOf(10);
  if (last < 0 && size > limit) throw new Error("Capture line exceeds 32 MiB.");
  return last < 0 ? 0 : size - limit + last + 1;
}

/** Follow all sessions admitted by the ledger. Unknown sessions leave private byte-range
 * journals before the checkpoint advances; no raw prompt or tool output is copied. */
export async function syncAllOtel(
  options: AllOptions,
  snapshot: () => Promise<Snapshot>,
  permits: (
    admission: SessionAdmission,
    at: string,
    start?: string,
    current?: string
  ) => Promise<Consent>,
  cloneProof?: (
    admission: SessionAdmission,
    at: string,
    start?: string,
    current?: string
  ) => Promise<string | null>
) {
  const base = asOptions(options, "auto");
  destination(base, "logs");
  const capture = join(
    options.home,
    ".local/share/aidd-otel-observation",
    `${options.config}.jsonl`
  );
  const directory = join(options.stateDir, "otel-sync");
  await privateDirectory(directory);
  const checkpointPath = join(directory, `${key(options, "auto")}.checkpoint.json`);
  const lock = new LedgerLock(`${checkpointPath}.lock`, {
    name: "OTLP sync",
    waitMs: 0,
    staleAfterMs: Number.MAX_SAFE_INTEGER,
  });
  const release = await lock.acquire();
  const projects =
    options.config === CODEX_CONFIG_ID && options.includeSessionProjects
      ? createSessionProjectPublisher(options.home, options.onProjectUnavailable)
      : undefined;
  const repositories =
    options.config === CODEX_CONFIG_ID && options.includeSessionRepositories
      ? createSessionRepositoryPublisher(options.home, options.onRepositoryUnavailable)
      : undefined;
  const titles =
    options.config === CODEX_CONFIG_ID && options.includeSessionTitles
      ? createSessionTitlePublisher(options.home, { onUnavailable: options.onTitleUnavailable })
      : undefined;
  let file: Awaited<ReturnType<typeof open>> | undefined;
  try {
    file = await open(capture, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = await file.stat();
    if (!info.isFile() || (info.mode & 0o077) !== 0)
      throw new Error("Capture must be a private regular file.");
    const previous = await readCheckpoint(checkpointPath);
    if (
      previous &&
      (previous.device !== info.dev || previous.inode !== info.ino || previous.offset > info.size)
    ) {
      throw new Error(
        "Capture changed since the last sync; recover the previous capture before restarting."
      );
    }
    let offset = previous?.offset ?? (await initialOffset(file, info.size));
    const save = async (position: number) =>
      saveCheckpoint(checkpointPath, { device: info.dev, inode: info.ino, offset: position });
    await save(offset);
    let held = await snapshot();
    let lastSnapshotAt = Date.now();
    let dirty = false;
    let pendingBytes = Buffer.alloc(0);
    const sessions = new Map<string, SessionState>();
    let sent = 0;
    let denied = 0;
    const oversized = new Set<string>();
    const pendingDirectory = join(directory, `${key(options, "auto")}.pending`);
    await privateDirectory(pendingDirectory);
    const pendingPath = (id: string) => join(pendingDirectory, `${key(options, id)}.jsonl`);
    const sessionState = async (id: string): Promise<SessionState> => {
      const existing = sessions.get(id);
      if (existing) return existing;
      const saved = await readBindingDetails(join(directory, `${key(options, id)}.json`));
      if (saved?.details && saved.details.session !== id)
        throw new Error("Sync binding state does not match its session.");
      const state = {
        identity: {
          values: new Map<string, string>(),
          conflict: saved?.details?.conflict === true,
        },
        identityEvidence: [] as IdentityEvidence[],
        identityAdmissionKey: null,
        identityAdmission: null,
        identityCloneKey: null,
        previousLinkUnverified: saved?.mayHaveLinked === true,
        savedIdentity: saved?.details ?? null,
        mayHaveLinked: saved?.mayHaveLinked === true,
        binding: saved?.details?.binding ?? "",
        needsReplay: Boolean(
          saved?.mayHaveLinked && saved.details && saved.details.binding !== "invalidated"
        ),
      };
      sessions.set(id, state);
      return state;
    };
    const loadBindings = async () => {
      const files = new Set(await readdir(directory));
      for (const [id] of held) {
        if (sessions.has(id)) continue;
        const name = `${key(options, id)}.json`;
        if (!files.has(name)) continue;
        const saved = await readBindingDetails(join(directory, name));
        if (!saved?.details) continue; // Older states need a bounded session replay to recover identity.
        if (saved.details.session !== id)
          throw new Error("Sync binding state does not match its session.");
        sessions.set(id, {
          identity: {
            values: new Map(),
            conflict: saved.details.conflict === true,
          },
          identityEvidence: [],
          identityAdmissionKey: null,
          identityAdmission: null,
          identityCloneKey: null,
          previousLinkUnverified: saved.mayHaveLinked,
          savedIdentity: saved.details,
          mayHaveLinked: saved.mayHaveLinked,
          binding: saved.details.binding,
          needsReplay: saved.mayHaveLinked && saved.details.binding !== "invalidated",
        });
      }
    };
    const stillPermitted = async (
      id: string,
      admission: SessionAdmission,
      items: readonly Transfer[],
      expectedFeature?: SessionFeature
    ) => {
      const current = (await snapshot()).get(id);
      if (!sameSessionAdmission(admission, current) || !current) return false;
      if (expectedFeature && !sameSessionFeature(expectedFeature, current.feature)) return false;
      const consentAt = new Date().toISOString();
      for (const item of items)
        if (!item.at || (await permits(current, item.at, item.start, consentAt)) !== "allow")
          return false;
      return true;
    };
    const restoreIdentity = async (
      id: string,
      admission: SessionAdmission,
      state: SessionState
    ) => {
      const saved = state.savedIdentity;
      const proof = saved?.identityProof;
      if (
        saved &&
        proof?.version === 2 &&
        proof.admissionKey !== admissionKey(admission) &&
        admission.cwd &&
        admission.repositoryId === null &&
        admission.feature.state === "ambiguous" &&
        proof.cwdKey === cwdKey(admission.cwd) &&
        proof.cloneKey &&
        cloneProof &&
        state.mayHaveLinked &&
        saved.binding !== "invalidated"
      ) {
        const matches = async () => {
          if (
            !(await stillPermitted(
              id,
              admission,
              evidenceTransfers(proof.sources),
              admission.feature
            ))
          )
            return false;
          const now = new Date().toISOString();
          for (const source of proof.sources)
            if ((await cloneProof(admission, source.at, source.start, now)) !== proof.cloneKey)
              return false;
          return true;
        };
        if (!(await matches())) return;
        const event = bindingTransfer(
          asOptions(options, id),
          { values: new Map(saved.identity), conflict: saved.conflict === true },
          { state: "ambiguous" }
        );
        if (!event || !(await deliver(id, event, matches))) return;
        sent++;
        await saveBindingState(
          join(directory, `${key(options, id)}.json`),
          directory,
          { session: id, identity: [], binding: "invalidated" },
          false
        );
        state.binding = "invalidated";
        state.mayHaveLinked = false;
        state.previousLinkUnverified = false;
        state.savedIdentity = null;
        return;
      }
      if (
        !saved ||
        !proof ||
        proof.admissionKey !== admissionKey(admission) ||
        !(await stillPermitted(id, admission, evidenceTransfers(proof.sources)))
      )
        return;
      if (proof.version === 2) {
        if (
          !admission.cwd ||
          proof.cwdKey !== cwdKey(admission.cwd) ||
          !proof.cloneKey ||
          !cloneProof
        )
          return;
        const now = new Date().toISOString();
        for (const source of proof.sources)
          if ((await cloneProof(admission, source.at, source.start, now)) !== proof.cloneKey)
            return;
      }
      state.identity.values.clear();
      for (const [name, value] of saved.identity) state.identity.values.set(name, value);
      state.identity.conflict ||= saved.conflict === true;
      state.identityEvidence.splice(0, state.identityEvidence.length, ...proof.sources);
      state.identityAdmissionKey = proof.admissionKey;
      state.identityAdmission = admission;
      state.identityCloneKey = proof.version === 2 ? (proof.cloneKey ?? null) : null;
      state.previousLinkUnverified = false;
      state.savedIdentity = null;
    };
    const stateProof = async (state: SessionState): Promise<BindingDetails["identityProof"]> => {
      if (!state.identityAdmissionKey || !state.identityEvidence.length) return undefined;
      const admission = state.identityAdmission;
      if (cloneProof && admission?.cwd) {
        let clone: string | null = null;
        const now = new Date().toISOString();
        for (const source of state.identityEvidence) {
          const found = await cloneProof(admission, source.at, source.start, now);
          if (!found || (clone && found !== clone)) return undefined;
          clone = found;
        }
        if (clone && state.identityCloneKey === clone)
          return {
            version: 2,
            admissionKey: state.identityAdmissionKey,
            cwdKey: cwdKey(admission.cwd),
            cloneKey: clone,
            sources: state.identityEvidence,
          };
        return undefined;
      }
      return {
        version: 1,
        admissionKey: state.identityAdmissionKey,
        sources: state.identityEvidence,
      };
    };
    const deliver = async (id: string, transfer: Transfer, guard: () => Promise<boolean>) => {
      try {
        await send(asOptions(options, id), transfer, guard);
        return true;
      } catch (error) {
        if (error instanceof ConsentNotConfirmedError) return false;
        throw error;
      }
    };
    const proofForTransfers = async (
      admission: SessionAdmission,
      transfers: readonly Transfer[]
    ) => {
      if (!cloneProof || !admission.cwd || transfers.length === 0) return null;
      const now = new Date().toISOString();
      let clone: string | null = null;
      for (const transfer of transfers) {
        if (!transfer.at || (transfer.signal === "metrics" && !transfer.start)) return null;
        const found = await cloneProof(admission, transfer.at, transfer.start, now);
        if (!found || (clone && found !== clone)) return null;
        clone = found;
      }
      return clone;
    };
    const reconcileIdentity = async (
      id: string,
      admission: SessionAdmission,
      state: SessionState
    ) => {
      if (!state.identityEvidence.length) return true;
      const current = (await snapshot()).get(id);
      if (!current || !sameSessionAdmission(admission, current)) return false;
      if (state.identityAdmissionKey === admissionKey(admission)) {
        const consentAt = new Date().toISOString();
        let allowed = true;
        for (const item of evidenceTransfers(state.identityEvidence))
          if (!item.at || (await permits(current, item.at, item.start, consentAt)) !== "allow") {
            allowed = false;
            break;
          }
        if (allowed) return true;
      }

      const previous = state.identityAdmission;
      if (
        state.mayHaveLinked &&
        state.binding !== "invalidated" &&
        previous?.cwd &&
        previous.repositoryId &&
        state.identityAdmissionKey === admissionKey(previous) &&
        admission.cwd === previous.cwd &&
        admission.repositoryId === null &&
        admission.feature.state === "ambiguous" &&
        (!cloneProof ||
          (state.identityCloneKey &&
            (await proofForTransfers(admission, evidenceTransfers(state.identityEvidence))) ===
              state.identityCloneKey))
      ) {
        const event = bindingTransfer(asOptions(options, id), state.identity, {
          state: "ambiguous",
        });
        if (event) {
          const evidence = [event, ...evidenceTransfers(state.identityEvidence)];
          if (
            !(await deliver(id, event, () =>
              stillPermitted(id, admission, evidence, admission.feature)
            ))
          )
            return false;
          sent++;
          state.binding = "invalidated";
          await saveBindingState(
            join(directory, `${key(options, id)}.json`),
            directory,
            {
              session: id,
              identity: [],
              binding: state.binding,
            },
            false
          );
          state.mayHaveLinked = false;
        }
      }
      if (state.mayHaveLinked) state.previousLinkUnverified = true;
      state.identity.values.clear();
      state.identityEvidence.length = 0;
      state.identityAdmissionKey = null;
      state.identityAdmission = null;
      state.identityCloneKey = null;
      return true;
    };
    const process = async (
      id: string,
      items: readonly Transfer[],
      admission: SessionAdmission,
      state: SessionState,
      hold = false,
      expectedClone?: string,
      captured?: { clone: string | null }
    ): Promise<"resolved" | "unknown" | "hold"> => {
      let wait = false;
      let rejected = 0;
      const allowed: Transfer[] = [];
      const verdicts = new Map<string, Consent>();
      await restoreIdentity(id, admission, state);
      if (!(await reconcileIdentity(id, admission, state))) return "unknown";
      for (const transfer of items) {
        if (!transfer.at || (transfer.signal === "metrics" && !transfer.start)) {
          rejected++;
          continue;
        }
        const stamp = `${transfer.at}\0${transfer.start ?? ""}`;
        let verdict = verdicts.get(stamp);
        if (verdict === undefined) {
          verdict = await permits(admission, transfer.at, transfer.start);
          verdicts.set(stamp, verdict);
        }
        if (verdict === "unknown") wait = true;
        else if (verdict === "deny") {
          // A repository can change between the snapshot and the consent check. A denial
          // against that stale admission is not evidence that the call lacked consent.
          if (!sameSessionAdmission(admission, (await snapshot()).get(id))) return "unknown";
          if (hold) wait = true;
          else rejected++;
        } else {
          allowed.push(transfer);
        }
      }
      // Retrying a partly sent source line would resend its earlier observations.
      if (wait) return hold ? "hold" : "unknown";
      let batches: ReturnType<typeof packTransfers>;
      try {
        batches = packTransfers(allowed, false);
      } catch (error) {
        if (!(error instanceof OtelObservationTooLargeError)) throw error;
        batches = [];
      }
      if (allowed.length > 0 && batches.length !== 1) {
        if (!oversized.has(id)) {
          console.error(
            "A captured OTLP line exceeds the 2 MiB delivery limit; it remains pending."
          );
          oversized.add(id);
        }
        return hold ? "hold" : "unknown";
      }
      const clone = allowed.length ? await proofForTransfers(admission, allowed) : null;
      if (
        allowed.length &&
        cloneProof &&
        (!clone ||
          (expectedClone && clone !== expectedClone) ||
          (state.identityCloneKey && state.identityCloneKey !== clone))
      )
        return hold ? "hold" : "unknown";
      if (captured) captured.clone = clone;
      for (const transfer of allowed) {
        observeIdentity(transfer, asOptions(options, id), state.identity, state.identityEvidence);
        if (state.identityEvidence.length) {
          state.identityAdmissionKey = admissionKey(admission);
          state.identityAdmission = admission;
          state.identityCloneKey ??= clone;
        }
      }
      if (state.identity.conflict && !state.previousLinkUnverified)
        await saveBindingState(
          join(directory, `${key(options, id)}.json`),
          directory,
          {
            session: id,
            identity: [...state.identity.values],
            binding: state.binding,
            conflict: true,
            identityProof: await stateProof(state),
          },
          state.mayHaveLinked
        );
      for (const batch of batches) {
        if (
          !(await deliver(
            id,
            batch.transfer,
            async () =>
              (await stillPermitted(id, admission, batch.items)) &&
              (!clone || (await proofForTransfers(admission, batch.items)) === clone)
          ))
        )
          return "hold";
        sent += batch.count;
      }
      denied += rejected;
      return "resolved";
    };
    const bindings = async () => {
      for (const [id, state] of sessions) {
        const admission = held.get(id);
        if (admission) await restoreIdentity(id, admission, state);
        if (admission && !(await reconcileIdentity(id, admission, state))) continue;
        if (!admission || state.previousLinkUnverified) continue;
        const feature: SessionFeature = admission.feature;
        const next =
          feature.state === "confirmed" ? `${feature.branch}\0${feature.feature}` : feature.state;
        const invalid =
          state.mayHaveLinked &&
          (state.identity.conflict ||
            feature.state !== "confirmed" ||
            (state.binding !== "" && state.binding !== next));
        if (invalid && state.binding === "invalidated") continue;
        if (
          !invalid &&
          (feature.state !== "confirmed" || (state.binding === next && !state.needsReplay))
        )
          continue;
        if ((await permits(admission, new Date().toISOString())) !== "allow") continue;
        if (invalid && state.binding !== "invalidated") {
          const event = bindingTransfer(asOptions(options, id), state.identity, {
            state: "ambiguous",
          });
          if (event) {
            if (
              !(await deliver(id, event, () =>
                stillPermitted(
                  id,
                  admission,
                  [event, ...evidenceTransfers(state.identityEvidence)],
                  feature
                )
              ))
            )
              continue;
            sent++;
            state.binding = "invalidated";
            await saveBindingState(join(directory, `${key(options, id)}.json`), directory, {
              session: id,
              identity: [...state.identity.values],
              binding: state.binding,
              identityProof: await stateProof(state),
            });
          }
        } else if (
          !invalid &&
          feature.state === "confirmed" &&
          (state.binding !== next || state.needsReplay)
        ) {
          const event = bindingTransfer(asOptions(options, id), state.identity, feature);
          if (event) {
            const proof = await stateProof(state);
            if (cloneProof && proof?.version !== 2) continue;
            await saveBindingState(join(directory, `${key(options, id)}.json`), directory, {
              session: id,
              identity: [...state.identity.values],
              binding: next,
              identityProof: proof,
            });
            state.mayHaveLinked = true;
            if (
              !(await deliver(
                id,
                event,
                async () =>
                  (await stillPermitted(
                    id,
                    admission,
                    [event, ...evidenceTransfers(state.identityEvidence)],
                    feature
                  )) &&
                  (!proof?.cloneKey ||
                    (await proofForTransfers(
                      admission,
                      evidenceTransfers(state.identityEvidence)
                    )) === proof.cloneKey)
              ))
            )
              continue;
            sent++;
            state.binding = next;
            state.needsReplay = false;
          }
        }
      }
    };
    const publishTitles = async () => {
      if (!titles && !projects && !repositories) return;
      for (const [id, state] of sessions) {
        const admission = held.get(id);
        if (admission) await restoreIdentity(id, admission, state);
        if (!admission || state.identity.conflict) continue;
        if ((await permits(admission, new Date().toISOString())) !== "allow") continue;
        for (const publisher of [titles, projects, repositories])
          if (
            publisher &&
            (await publisher.publish(id, state.identity, async (event) => {
              if (!event.at || (await permits(admission, event.at)) !== "allow") return false;
              return deliver(id, event, () =>
                stillPermitted(id, admission, [event, ...evidenceTransfers(state.identityEvidence)])
              );
            }))
          )
            sent++;
      }
    };
    const flushPending = async () => {
      const files = new Set(await readdir(pendingDirectory));
      for (const [id, admission] of held) {
        const path = pendingPath(id);
        if (!files.has(`${key(options, id)}.jsonl`)) continue;
        const state = await sessionState(id);
        const waiting: Pending[] = [];
        for (const item of await pendingRanges(path)) {
          const raw = Buffer.alloc(item.length);
          const read = await file?.read(raw, 0, item.length, item.offset);
          if (!read || read.bytesRead !== item.length || raw.at(-1) !== 10)
            throw new Error("Pending capture range is unavailable; recover the capture.");
          const transfers = selectTransfers(raw.toString("utf8"), asOptions(options, id), {
            values: new Map(),
            conflict: false,
          });
          const changedAdmission = item.hold && item.admissionKey !== admissionKey(admission);
          if (
            changedAdmission &&
            (!item.cwdKey ||
              !item.cloneKey ||
              !admission.cwd ||
              admission.repositoryId !== null ||
              admission.feature.state !== "ambiguous" ||
              item.cwdKey !== cwdKey(admission.cwd))
          ) {
            waiting.push(item);
            continue;
          }
          const captured = { clone: null as string | null };
          const status = await process(
            id,
            transfers,
            admission,
            state,
            item.hold,
            item.cloneKey,
            captured
          );
          if (status !== "resolved")
            waiting.push({
              ...item,
              hold: item.hold || status === "hold",
              admissionKey:
                item.hold || status === "hold"
                  ? (item.admissionKey ?? admissionKey(admission))
                  : undefined,
              ...(status === "hold" && admission.cwd && captured.clone && !item.hold
                ? { cwdKey: cwdKey(admission.cwd), cloneKey: captured.clone }
                : {}),
            });
        }
        await replacePending(path, waiting);
      }
    };
    await loadBindings();
    await flushPending();
    await bindings();
    await publishTitles();
    const buffer = Buffer.alloc(65536);
    for (;;) {
      const { bytesRead } = await file.read(buffer, 0, buffer.length, offset + pendingBytes.length);
      if (bytesRead > 0) {
        pendingBytes = Buffer.concat([pendingBytes, buffer.subarray(0, bytesRead)]);
        if (pendingBytes.length > MAX_LINE) throw new Error("Capture line exceeds 32 MiB.");
        for (
          let newline = pendingBytes.indexOf(10);
          newline >= 0;
          newline = pendingBytes.indexOf(10)
        ) {
          const raw = pendingBytes.subarray(0, newline).toString("utf8");
          const position = offset;
          if (raw.trim())
            for (const id of sessionIdsInCapture(raw, options.config)) {
              const state = await sessionState(id);
              const items = selectTransfers(raw, asOptions(options, id), {
                values: new Map(),
                conflict: false,
              });
              const admission = held.get(id);
              const captured = { clone: null as string | null };
              const status =
                items.length === 0
                  ? "resolved"
                  : admission
                    ? await process(id, items, admission, state, false, undefined, captured)
                    : "unknown";
              if (status !== "resolved")
                await appendPending(pendingPath(id), {
                  offset: position,
                  length: newline + 1,
                  hold: status === "hold",
                  admissionKey:
                    status === "hold" && admission ? admissionKey(admission) : undefined,
                  ...(status === "hold" && admission?.cwd && captured.clone
                    ? { cwdKey: cwdKey(admission.cwd), cloneKey: captured.clone }
                    : {}),
                });
            }
          offset += newline + 1;
          pendingBytes = pendingBytes.subarray(newline + 1);
          dirty = true;
        }
        if (dirty) await save(offset);
        continue;
      }
      const current = await lstat(capture);
      if (
        !current.isFile() ||
        current.ino !== info.ino ||
        current.dev !== info.dev ||
        current.size < offset + pendingBytes.length
      ) {
        throw new Error(
          "Capture was replaced or truncated; recover the previous capture before restarting."
        );
      }
      const elapsed = Date.now() - lastSnapshotAt;
      const retryAfter = options.refreshMs ?? RETRY_MS;
      const bindingAfter = options.refreshMs ?? BINDING_REFRESH_MS;
      const pendingFiles = (await readdir(pendingDirectory)).length;
      if (
        dirty ||
        (pendingFiles > 0 && elapsed >= retryAfter) ||
        (sessions.size > 0 && elapsed >= bindingAfter)
      ) {
        held = await snapshot();
        await loadBindings();
        lastSnapshotAt = Date.now();
        dirty = false;
        await flushPending();
        await bindings();
        await publishTitles();
        await save(offset);
      }
      if (options.signal?.aborted)
        return { sent, denied, pending: (await readdir(pendingDirectory)).length };
      try {
        await delay(options.intervalMs ?? INTERVAL_MS, undefined, { signal: options.signal });
      } catch (error) {
        if (options.signal?.aborted)
          return { sent, denied, pending: (await readdir(pendingDirectory)).length };
        throw error;
      }
    }
  } finally {
    titles?.close();
    projects?.close();
    repositories?.close();
    await file?.close();
    await release();
  }
}
