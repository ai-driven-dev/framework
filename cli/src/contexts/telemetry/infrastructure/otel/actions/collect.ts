import { randomBytes, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { asPlainObject } from "../../../../../kernel/reading/plain-object.js";
import { OTEL_CONFIGS, readToken } from "../settings.js";

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_CLIENTS = 16;
const PATH = /^\/([^/]+)\/v1\/(logs|metrics|traces)$/;
const CAPTURE_TOOLS = new Set<string>(OTEL_CONFIGS);

async function tokenFor(home: string, directory: string): Promise<string> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || (info.mode & 0o077) !== 0) {
    throw new Error("OTLP capture directory must be private.");
  }
  const path = join(directory, "collector-token");
  try {
    await writeFile(path, `${randomBytes(32).toString("base64url")}\n`, {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
  }
  return readToken(home);
}

function authorized(request: IncomingMessage, token: string): boolean {
  const given = request.headers.authorization ?? "";
  const expected = `Bearer ${token}`;
  if (!/^[\x20-\x7e]+$/.test(given)) return false;
  const a = Buffer.from(given, "ascii");
  const b = Buffer.from(expected, "ascii");
  return a.length === b.length && timingSafeEqual(a, b);
}

class RequestError extends Error {
  constructor(readonly status: number) {
    super("Invalid OTLP request.");
  }
}

async function readPayload(request: IncomingMessage): Promise<Record<string, unknown>> {
  const length = Number(request.headers["content-length"] ?? 0);
  if (!Number.isSafeInteger(length) || length < 0) throw new RequestError(400);
  if (length > MAX_BYTES) throw new RequestError(413);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BYTES) throw new RequestError(413);
    chunks.push(buffer);
  }
  if (size === 0) throw new RequestError(400);
  let raw = Buffer.concat(chunks);
  const encoding = (request.headers["content-encoding"] ?? "").toLowerCase();
  if (encoding && encoding !== "identity" && encoding !== "gzip") throw new RequestError(415);
  if (encoding === "gzip") {
    try {
      raw = gunzipSync(raw, { maxOutputLength: MAX_BYTES });
    } catch {
      throw new RequestError(400);
    }
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new RequestError(400);
  }
  const payload = asPlainObject(parsed);
  if (!payload) throw new RequestError(400);
  return payload;
}

async function appendCapture(path: string, line: string): Promise<void> {
  const file = await open(
    path,
    constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW,
    0o600
  );
  try {
    if (!(await file.stat()).isFile()) throw new Error("Capture must be a regular file.");
    await file.chmod(0o600);
    await file.writeFile(line, "utf8");
  } finally {
    await file.close();
  }
}

/** A local authenticated OTLP/HTTP JSON collector. It never records request headers. */
export async function startOtelCollector(options: {
  readonly home: string;
  readonly port: number;
}) {
  if (process.platform === "win32")
    throw new Error("OTLP collection requires private POSIX files.");
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535)
    throw new Error("Collector port must be between 0 and 65535.");
  const directory = join(options.home, ".local/share/aidd-otel-observation");
  const token = await tokenFor(options.home, directory);
  for (const tool of OTEL_CONFIGS) {
    await appendCapture(join(directory, `${tool}.jsonl`), "");
  }
  let clients = 0;
  let queue = Promise.resolve();
  const append = (path: string, line: string) => {
    const work = queue.then(() => appendCapture(path, line));
    queue = work.catch(() => {});
    return work;
  };
  const server = createServer((request, response) => {
    if (clients >= MAX_CLIENTS) {
      response.writeHead(503).end();
      return;
    }
    clients++;
    void handle(request, response)
      .finally(() => {
        clients--;
      })
      .catch(() => {});
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      if (!authorized(request, token)) throw new RequestError(403);
      const path = PATH.exec(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
      if (request.method !== "POST" || !path || !CAPTURE_TOOLS.has(path[1]))
        throw new RequestError(404);
      const payload = await readPayload(request);
      const line = `${JSON.stringify({ received_at: new Date().toISOString(), signal: path[2], payload })}\n`;
      if (Buffer.byteLength(line) > MAX_BYTES) throw new RequestError(413);
      await append(join(directory, `${path[1]}.jsonl`), line);
      response.writeHead(200, { "content-type": "application/json" }).end("{}");
    } catch (error) {
      if (!response.headersSent && !response.destroyed)
        response.writeHead(error instanceof RequestError ? error.status : 500).end();
    }
  }
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Collector did not open a TCP port.");
  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  };
}
