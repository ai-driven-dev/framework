import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { join } from "node:path";
import {
  type SessionAdmission,
  sameSessionAdmission,
} from "../../../domain/report/session-feature.js";
import { CODEX_CONFIG_ID } from "../settings.js";
import { createSessionProjectPublisher } from "./metadata/session-project.js";
import { createSessionRepositoryPublisher } from "./metadata/session-repository.js";
import { createSessionTitlePublisher } from "./metadata/session-title.js";
import {
  destination,
  type Identity,
  type SyncOptions,
  selectTransfers,
  send,
  sessionIdsInCapture,
} from "./sync.js";

type Consent = "allow" | "deny" | "unknown";
export type TitleOptions = Omit<SyncOptions, "session" | "follow" | "titlesOnly">;
const MAX_LINE = 32 * 1024 * 1024;

function alreadyKnown(identity: Identity | undefined, observed: Identity): boolean {
  if (identity?.conflict) return true;
  if (observed.conflict) return false;
  return [...observed.values].every(([key, value]) => identity?.values.get(key) === value);
}

/** Read a fixed snapshot once; unlike follow, this never writes a capture checkpoint. */
export async function syncAllSessionTitles(
  options: TitleOptions,
  snapshot: () => Promise<ReadonlyMap<string, SessionAdmission>>,
  permits: (
    admission: SessionAdmission,
    at: string,
    start?: string,
    current?: string
  ) => Promise<Consent>
) {
  if (options.config !== CODEX_CONFIG_ID || !options.includeSessionTitles)
    throw new Error("Title-only sync requires Codex and explicit title opt-in.");
  const base: SyncOptions = { ...options, session: "auto", follow: false };
  destination(base, "logs");
  const held = await snapshot();
  const path = join(options.home, ".local/share/aidd-otel-observation", "codex.jsonl");
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const identities = new Map<string, Identity>();
  const projects = options.includeSessionProjects
    ? createSessionProjectPublisher(options.home, options.onProjectUnavailable)
    : undefined;
  const repositories = options.includeSessionRepositories
    ? createSessionRepositoryPublisher(options.home, options.onRepositoryUnavailable)
    : undefined;
  const titles = createSessionTitlePublisher(options.home, {
    onUnavailable: options.onTitleUnavailable,
  });
  try {
    const info = await file.stat();
    if (!info.isFile() || (info.mode & 0o077) !== 0)
      throw new Error("Capture must be a private regular file.");
    const consume = async (line: string) => {
      if (!line.trim()) return;
      for (const session of sessionIdsInCapture(line, CODEX_CONFIG_ID)) {
        const admission = held.get(session);
        if (!admission) continue;
        const sessionOptions: SyncOptions = { ...base, session };
        const scratch: Identity = { values: new Map(), conflict: false };
        const transfers = selectTransfers(line, sessionOptions, scratch);
        for (const transfer of transfers) {
          if (!transfer.at || (transfer.signal === "metrics" && !transfer.start)) continue;
          const source = JSON.stringify({ signal: transfer.signal, payload: transfer.payload });
          const observed: Identity = { values: new Map(), conflict: false };
          selectTransfers(source, sessionOptions, observed);
          const identity = identities.get(session);
          if (alreadyKnown(identity, observed)) continue;
          if ((await permits(admission, transfer.at, transfer.start)) !== "allow") continue;
          const accepted = identity ?? { values: new Map(), conflict: false };
          selectTransfers(source, sessionOptions, accepted);
          identities.set(session, accepted);
        }
      }
    };
    let offset = 0;
    let pending = Buffer.alloc(0);
    const buffer = Buffer.alloc(65536);
    while (offset < info.size) {
      const length = Math.min(buffer.length, info.size - offset);
      const { bytesRead } = await file.read(buffer, 0, length, offset);
      if (!bytesRead) throw new Error("Capture changed while titles were being read.");
      offset += bytesRead;
      pending = Buffer.concat([pending, buffer.subarray(0, bytesRead)]);
      for (let newline = pending.indexOf(10); newline >= 0; newline = pending.indexOf(10)) {
        if (newline > MAX_LINE) throw new Error("Capture line exceeds 32 MiB.");
        await consume(pending.subarray(0, newline).toString("utf8"));
        pending = pending.subarray(newline + 1);
      }
      if (pending.length > MAX_LINE) throw new Error("Capture line exceeds 32 MiB.");
    }
    const current = await lstat(path);
    if (
      !current.isFile() ||
      current.ino !== info.ino ||
      current.dev !== info.dev ||
      current.size < info.size
    )
      throw new Error("Capture was replaced or truncated; restart title sync.");
    let sent = 0;
    let identified = 0;
    let currentConsenting = 0;
    for (const [session, identity] of identities) {
      const admission = held.get(session);
      if (
        !admission ||
        identity.conflict ||
        (!identity.values.get("user.email") && !identity.values.get("user.account_id"))
      )
        continue;
      identified++;
      if ((await permits(admission, new Date().toISOString())) !== "allow") continue;
      currentConsenting++;
      let stillConsenting = true;
      for (const publisher of [titles, projects, repositories])
        if (
          publisher &&
          (await publisher.publish(session, identity, async (event) => {
            if (!event.at || (await permits(admission, event.at)) !== "allow") {
              if (stillConsenting) currentConsenting--;
              stillConsenting = false;
              return false;
            }
            await send({ ...base, session }, event, async () => {
              const current = (await snapshot()).get(session);
              return (
                !!current &&
                sameSessionAdmission(admission, current) &&
                !!event.at &&
                (await permits(current, event.at, undefined, new Date().toISOString())) === "allow"
              );
            });
            return true;
          }))
        )
          sent++;
    }
    return { sent, identified, currentConsenting, partialLine: pending.length > 0 };
  } finally {
    titles.close();
    projects?.close();
    repositories?.close();
    await file.close();
  }
}
