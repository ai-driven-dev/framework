import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { asPlainObject } from "../../../../../../kernel/reading/plain-object.js";
import { CODEX_CONFIG_ID } from "../../settings.js";
import type { Identity, Transfer } from "../sync.js";

export type Request = (method: string, params: object) => Promise<unknown>;
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
  return metadataTransfer(session, { ...identity, values }, at);
}

function metadataTransfer(session: string, identity: Identity, at: Date): Transfer {
  const values = new Map(identity.values);
  values.set("conversation.id", session);
  values.set("event.timestamp", at.toISOString());
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

class AppServer<T> {
  private child: ChildProcessWithoutNullStreams;
  private nextId = 0;
  private pending = new Map<number, { resolve: (result: unknown) => void; reject: () => void }>();
  private ready: Promise<unknown>;
  private failed = false;

  constructor(
    home: string,
    private readValue: (request: Request, session: string) => Promise<T>,
    experimental = false
  ) {
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
      ...(experimental ? { capabilities: { experimentalApi: true } } : {}),
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

  async read(session: string): Promise<T> {
    await this.ready;
    return this.readValue((method, params) => this.request(method, params), session);
  }

  close(): void {
    this.fail();
    this.child.kill();
  }

  get unavailable(): boolean {
    return this.failed;
  }
}

type Reader<T> = { read(session: string): Promise<T>; close(): void; unavailable?: boolean };

export type Metadata = { available: true; values: Record<string, string> } | { available: false };

function createPublisher<T extends { available: boolean }>(
  home: string,
  read: (request: Request, session: string) => Promise<T>,
  transfer: (session: string, identity: Identity, result: T, at: Date) => Transfer | null,
  experimental: boolean,
  dependencies: {
    now?: () => number;
    createReader?: (home: string) => Reader<T>;
    onUnavailable?: () => void;
  } = {}
) {
  let server: Reader<T> | undefined;
  const checked = new Map<string, number>();
  const previous = new Map<string, string>();
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
      server ??= (dependencies.createReader ?? ((path) => new AppServer(path, read, experimental)))(
        home
      );
      const result = await server.read(session).catch(() => null);
      const observedAt = (dependencies.now ?? Date.now)();
      checked.set(session, observedAt);
      if (!result?.available) {
        if (server.unavailable) retryAfter = observedAt + REFRESH_MS;
        if (!warned) dependencies.onUnavailable?.();
        warned = true;
        return false;
      }
      const key = JSON.stringify(result);
      if (previous.get(session) === key) return false;
      const event = transfer(session, identity, result, new Date(observedAt));
      if (!event) return false;
      if (!(await send(event))) return false;
      previous.set(session, key);
      return true;
    },
    close(): void {
      server?.close();
    },
  };
}

export function createSessionTitlePublisher(
  home: string,
  dependencies: {
    now?: () => number;
    createReader?: (home: string) => Reader<Title>;
    onUnavailable?: () => void;
  } = {}
) {
  return createPublisher(
    home,
    readSessionTitle,
    (session, identity, result, at) =>
      result.available ? sessionTitleTransfer(session, identity, result.title, at) : null,
    false,
    dependencies
  );
}

export function createSessionMetadataPublisher(
  home: string,
  eventName: string,
  read: (request: Request, session: string) => Promise<Metadata>,
  onUnavailable?: () => void
) {
  return createPublisher(
    home,
    read,
    (session, identity, result, at) => {
      if (!result.available) return null;
      const values = new Map(identity.values);
      values.set("event.name", eventName);
      for (const [key, value] of Object.entries(result.values)) values.set(key, value);
      return metadataTransfer(session, { ...identity, values }, at);
    },
    true,
    { onUnavailable }
  );
}
