import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { asPlainObject } from "../../../../../kernel/reading/plain-object.js";
import type { SessionAdmission, SessionFeature } from "../../../domain/report/session-feature.js";
import { LedgerLock } from "../../ledger-lock.js";
import { CODEX_CONFIG_ID } from "../settings.js";
import { createSessionProjectPublisher } from "./metadata/session-project.js";
import { createSessionTitlePublisher } from "./metadata/session-title.js";
import {
  bindingTransfer,
  destination,
  type Identity,
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
}
interface SessionState {
  readonly identity: Identity;
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
      const length = Math.min(info.size, 64);
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
    await file.writeFile(`${item.offset} ${item.length}\n`);
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
      const parts = /^(\d+) (\d+)$/.exec(line);
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
      ranges.set(line, { offset, length });
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
      await file.writeFile(ranges.map((item) => `${item.offset} ${item.length}\n`).join(""));
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
  permits: (admission: SessionAdmission, at: string, start?: string) => Promise<Consent>
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
          values: new Map<string, string>(saved?.details?.identity ?? []),
          conflict: saved?.details?.conflict === true,
        },
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
            values: new Map(saved.details.identity),
            conflict: saved.details.conflict === true,
          },
          mayHaveLinked: saved.mayHaveLinked,
          binding: saved.details.binding,
          needsReplay: saved.mayHaveLinked && saved.details.binding !== "invalidated",
        });
      }
    };
    const process = async (
      id: string,
      items: readonly Transfer[],
      admission: SessionAdmission
    ): Promise<boolean> => {
      let wait = false;
      const allowed: Transfer[] = [];
      const verdicts = new Map<string, Consent>();
      for (const transfer of items) {
        if (!transfer.at || (transfer.signal === "metrics" && !transfer.start)) {
          denied++;
          continue;
        }
        const stamp = `${transfer.at}\0${transfer.start ?? ""}`;
        let verdict = verdicts.get(stamp);
        if (verdict === undefined) {
          verdict = await permits(admission, transfer.at, transfer.start);
          verdicts.set(stamp, verdict);
        }
        if (verdict === "unknown") wait = true;
        else if (verdict === "deny") denied++;
        else allowed.push(transfer);
      }
      for (const batch of packTransfers(allowed)) {
        await send(asOptions(options, id), batch.transfer);
        sent += batch.count;
      }
      return wait;
    };
    const bindings = async () => {
      for (const [id, state] of sessions) {
        const admission = held.get(id);
        if (!admission) continue;
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
            await send(asOptions(options, id), event);
            sent++;
            state.binding = "invalidated";
            await saveBindingState(join(directory, `${key(options, id)}.json`), directory, {
              session: id,
              identity: [...state.identity.values],
              binding: state.binding,
            });
          }
        } else if (
          !invalid &&
          feature.state === "confirmed" &&
          (state.binding !== next || state.needsReplay)
        ) {
          const event = bindingTransfer(asOptions(options, id), state.identity, feature);
          if (event) {
            await saveBindingState(join(directory, `${key(options, id)}.json`), directory, {
              session: id,
              identity: [...state.identity.values],
              binding: next,
            });
            state.mayHaveLinked = true;
            await send(asOptions(options, id), event);
            sent++;
            state.binding = next;
            state.needsReplay = false;
          }
        }
      }
    };
    const publishTitles = async () => {
      if (!titles && !projects) return;
      for (const [id, state] of sessions) {
        const admission = held.get(id);
        if (!admission || state.identity.conflict) continue;
        if ((await permits(admission, new Date().toISOString())) !== "allow") continue;
        for (const publisher of [titles, projects])
          if (
            publisher &&
            (await publisher.publish(id, state.identity, async (event) => {
              if (!event.at || (await permits(admission, event.at)) !== "allow") return false;
              await send(asOptions(options, id), event);
              return true;
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
          const transfers = selectTransfers(
            raw.toString("utf8"),
            asOptions(options, id),
            state.identity
          );
          if (state.identity.conflict) {
            await saveBindingState(
              join(directory, `${key(options, id)}.json`),
              directory,
              {
                session: id,
                identity: [...state.identity.values],
                binding: state.binding,
                conflict: true,
              },
              state.mayHaveLinked
            );
          }
          if (await process(id, transfers, admission)) waiting.push(item);
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
              const items = selectTransfers(raw, asOptions(options, id), state.identity);
              if (state.identity.conflict) {
                await saveBindingState(
                  join(directory, `${key(options, id)}.json`),
                  directory,
                  {
                    session: id,
                    identity: [...state.identity.values],
                    binding: state.binding,
                    conflict: true,
                  },
                  state.mayHaveLinked
                );
              }
              const admission = held.get(id);
              const waiting =
                items.length > 0 && (!admission || (await process(id, items, admission)));
              if (waiting)
                await appendPending(pendingPath(id), { offset: position, length: newline + 1 });
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
    await file?.close();
    await release();
  }
}
