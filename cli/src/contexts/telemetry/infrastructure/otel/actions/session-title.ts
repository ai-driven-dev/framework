import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { asPlainObject } from "../../../../../kernel/reading/plain-object.js";
import { CODEX_CONFIG_ID } from "../settings.js";
import type { Identity, Transfer } from "./sync.js";

type Request = (method: string, params: object) => Promise<unknown>;
type Title = { available: true; title: string | null } | { available: false };
const MAX_TITLE_LENGTH = 4096;
const REQUEST_TIMEOUT_MS = 5000;
const REFRESH_MS = 60_000;

export async function readSessionTitle(request: Request, session: string): Promise<Title> {
  let result: unknown;
  try {
    result = await request("thread/read", { threadId: session, includeTurns: false });
  } catch {
    return { available: false };
  }
  const thread = asPlainObject(asPlainObject(result)?.thread);
  if (!thread || thread.id !== session || thread.sessionId !== session) return { available: false };
  if (thread.name == null || (typeof thread.name === "string" && !thread.name.trim()))
    return { available: true, title: null };
  if (typeof thread.name !== "string" || thread.name.length > MAX_TITLE_LENGTH)
    return { available: false };
  return { available: true, title: thread.name };
}

export function sessionTitleTransfer(
  session: string,
  identity: Identity,
  title: string | null,
  at: Date
): Transfer | null {
  if (
    identity.conflict ||
    (!identity.values.get("user.email") && !identity.values.get("user.account_id"))
  )
    return null;
  const values = new Map(identity.values);
  values.set("conversation.id", session);
  values.set("event.name", "aidd.session_title");
  values.set("event.timestamp", at.toISOString());
  if (title !== null) values.set("aidd.session_title", title);
  return {
    signal: "logs",
    at: at.toISOString(),
    payload: {
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: [
                {
                  timeUnixNano: (BigInt(at.getTime()) * 1_000_000n).toString(),
                  attributes: [...values].map(([key, value]) => ({
                    key,
                    value: { stringValue: value },
                  })),
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

class AppServer {
  private child: ChildProcessWithoutNullStreams;
  private nextId = 0;
  private pending = new Map<number, { resolve: (result: unknown) => void; reject: () => void }>();
  private ready: Promise<unknown>;
  private failed = false;

  constructor(home: string) {
    this.child = spawn(CODEX_CONFIG_ID, ["app-server", "--listen", "stdio://"], {
      env: { ...process.env, HOME: home },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stderr.resume();
    this.child.stdin.on("error", () => this.fail());
    createInterface({ input: this.child.stdout }).on("line", (line) => this.receive(line));
    this.child.on("error", () => this.fail());
    this.child.on("exit", () => this.fail());
    this.ready = this.request("initialize", {
      clientInfo: { name: "aidd_telemetry", title: "AIDD telemetry", version: "1" },
    }).then(() => {
      this.child.stdin.write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
    });
  }

  private receive(line: string): void {
    let message: Record<string, unknown> | null;
    try {
      message = asPlainObject(JSON.parse(line));
    } catch {
      return;
    }
    if (!message || typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) pending.reject();
    else pending.resolve(message.result);
  }

  private fail(): void {
    this.failed = true;
    for (const pending of this.pending.values()) pending.reject();
    this.pending.clear();
  }

  private request(method: string, params: object): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        this.failed = true;
        this.child.kill();
        reject(new Error("Codex app-server did not respond."));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: () => {
          clearTimeout(timeout);
          reject(new Error("Codex app-server is unavailable."));
        },
      });
      this.child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  async read(session: string): Promise<Title> {
    try {
      await this.ready;
      return await readSessionTitle((method, params) => this.request(method, params), session);
    } catch {
      return { available: false };
    }
  }

  close(): void {
    this.fail();
    this.child.kill();
  }

  get unavailable(): boolean {
    return this.failed;
  }
}

type TitleReader = { read(session: string): Promise<Title>; close(): void; unavailable?: boolean };

export function createSessionTitlePublisher(
  home: string,
  dependencies: {
    now?: () => number;
    createReader?: (home: string) => TitleReader;
    onUnavailable?: () => void;
  } = {}
) {
  let server: TitleReader | undefined;
  const checked = new Map<string, number>();
  const previous = new Map<string, string | null>();
  let warned = false;
  let retryAfter = 0;
  return {
    async publish(
      session: string,
      identity: Identity,
      send: (transfer: Transfer) => Promise<boolean>
    ): Promise<boolean> {
      if (
        identity.conflict ||
        (!identity.values.get("user.email") && !identity.values.get("user.account_id"))
      )
        return false;
      const now = (dependencies.now ?? Date.now)();
      const last = checked.get(session);
      if ((last !== undefined && now - last < REFRESH_MS) || now < retryAfter) return false;
      if (server?.unavailable) {
        server.close();
        server = undefined;
      }
      server ??= (dependencies.createReader ?? ((path) => new AppServer(path)))(home);
      const result = await server.read(session);
      const observedAt = (dependencies.now ?? Date.now)();
      checked.set(session, observedAt);
      if (!result.available) {
        if (server.unavailable) retryAfter = observedAt + REFRESH_MS;
        if (!warned) dependencies.onUnavailable?.();
        warned = true;
        return false;
      }
      if (previous.has(session) && previous.get(session) === result.title) return false;
      const transfer = sessionTitleTransfer(session, identity, result.title, new Date(observedAt));
      if (!transfer) return false;
      if (!(await send(transfer))) return false;
      previous.set(session, result.title);
      return true;
    },
    close(): void {
      server?.close();
    },
  };
}
