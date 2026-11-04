import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { asPlainObject } from "../../../../../kernel/reading/plain-object.js";
import type { SessionFeature } from "../../../domain/report/session-feature.js";
import { CLAUDE_CONFIG_ID, CODEX_CONFIG_ID, type SyncConfig } from "../settings.js";

type FeatureState = SessionFeature;

export interface SyncOptions {
  readonly config: SyncConfig;
  readonly session: string;
  readonly tenant: string;
  readonly endpoint: string;
  readonly token: string;
  readonly home: string;
  readonly follow: boolean;
  readonly stateDir?: string;
  readonly signal?: AbortSignal;
  readonly intervalMs?: number;
}

type RecordObject = Record<string, unknown>;
const object = (value: unknown): RecordObject => asPlainObject(value) ?? {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const MAX_PAYLOAD = 2 * 1024 * 1024;
const MAX_LINE = 32 * 1024 * 1024;
const INTERVAL_MS = 5000;
const CLAUDE_METRICS = new Set([
  "claude_code.active_time.total",
  "claude_code.code_edit_tool.decision",
  "claude_code.commit.count",
  "claude_code.cost.usage",
  "claude_code.lines_of_code.count",
  "claude_code.pull_request.count",
  "claude_code.session.count",
  "claude_code.token.usage",
]);
const CODEX_EVENTS = new Set(["codex.conversation_starts", "codex.sse_event", "codex.tool_result"]);
const SAFE_ATTRIBUTES = new Set([
  "user.email",
  "user.account_id",
  "session.id",
  "conversation.id",
  "organization.id",
  "event.name",
  "event.kind",
  "event.sequence",
  "event.timestamp",
  "tool_use_id",
  "type",
  "model",
  "tool_name",
  "tool",
  "decision",
  "query_source",
  "app.version",
  "originator",
  "success",
  "duration_ms",
  "call_id",
  "input_token_count",
  "output_token_count",
  "cached_token_count",
  "cache_write_token_count",
  "reasoning_token_count",
]);

export interface Identity {
  readonly values: Map<string, string>;
  conflict: boolean;
}

function attributes(value: unknown): Map<string, string> {
  const out = new Map<string, string>();
  for (const item of array(value)) {
    const entry = object(item);
    const v = object(entry.value);
    const raw = v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue;
    if (typeof entry.key === "string" && raw !== undefined && raw !== null) {
      out.set(entry.key, String(raw));
    }
  }
  return out;
}

function merge(...maps: Map<string, string>[]): Map<string, string> {
  return new Map(maps.flatMap((map) => [...map]));
}

function safeAttributes(values: Map<string, string>) {
  return [...values]
    .filter(([key]) => SAFE_ATTRIBUTES.has(key))
    .map(([key, value]) => ({
      key,
      value: { stringValue: value },
    }));
}

function numericFields(source: RecordObject, keys: readonly string[]): RecordObject {
  const result: RecordObject = {};
  for (const key of keys) {
    const value = source[key];
    if (
      (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value)) ||
      (Array.isArray(value) &&
        value.every(
          (item) =>
            (typeof item === "number" && Number.isFinite(item)) ||
            (typeof item === "string" && /^-?\d+(?:\.\d+)?$/.test(item))
        ))
    )
      result[key] = value;
  }
  return result;
}

function captureIdentity(target: Identity, values: Map<string, string>) {
  for (const key of ["user.email", "user.account_id", "organization.id"]) {
    const value = values.get(key);
    if (!value) continue;
    const existing = target.values.get(key);
    if (existing !== undefined && existing.toLowerCase() !== value.toLowerCase())
      target.conflict = true;
    else target.values.set(key, value);
  }
}

function timeOf(entry: RecordObject) {
  return {
    ...(entry.timeUnixNano === undefined ? {} : { timeUnixNano: entry.timeUnixNano }),
    ...(entry.observedTimeUnixNano === undefined
      ? {}
      : { observedTimeUnixNano: entry.observedTimeUnixNano }),
  };
}

export interface Transfer {
  readonly signal: "logs" | "metrics";
  readonly payload: RecordObject;
  readonly at?: string;
  readonly start?: string;
}

/** Each item was separately consent-checked. Only points at the same instant and from the
 * same session are combined, with a hard upper bound matching the receiver. */
export function packTransfers(
  transfers: readonly Transfer[]
): Array<{ transfer: Transfer; count: number }> {
  const groups = new Map<string, Array<{ transfer: Transfer; count: number }>>();
  for (const item of transfers) {
    const key = `${item.signal}\0${item.at ?? ""}`;
    const root = item.signal === "logs" ? "resourceLogs" : "resourceMetrics";
    const resources = array(item.payload[root]);
    const batches = groups.get(key) ?? [];
    const last = batches.at(-1);
    const merged = last ? [...array(last.transfer.payload[root]), ...resources] : resources;
    const body = { [root]: merged };
    if (Buffer.byteLength(JSON.stringify(body)) > MAX_PAYLOAD) {
      if (Buffer.byteLength(JSON.stringify(item.payload)) > MAX_PAYLOAD)
        throw new Error("An OTLP observation exceeds the receiver's 2 MiB limit.");
      batches.push({ transfer: item, count: 1 });
    } else if (last) {
      batches[batches.length - 1] = {
        transfer: { ...last.transfer, payload: body },
        count: last.count + 1,
      };
    } else {
      batches.push({ transfer: item, count: 1 });
    }
    groups.set(key, batches);
  }
  return [...groups.values()].flat();
}

/** Names only session IDs; data from an unknown session is never sent until the ledger admits it. */
export function sessionIdsInCapture(line: string, config: SyncOptions["config"]): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error("Capture contains invalid JSON; sync stopped.");
  }
  const envelope = object(parsed);
  const payload = object(envelope.payload);
  const sessionKey = config === CLAUDE_CONFIG_ID ? "session.id" : "conversation.id";
  const ids = new Set<string>();
  const add = (resource: Map<string, string>, raw: unknown) => {
    const session = merge(resource, attributes(object(raw).attributes)).get(sessionKey);
    if (session && /^[A-Za-z0-9_-]{1,128}$/.test(session)) ids.add(session);
  };
  if (envelope.signal === "logs") {
    for (const raw of array(payload.resourceLogs)) {
      const resource = object(raw);
      const attrs = attributes(object(resource.resource).attributes);
      for (const scope of array(resource.scopeLogs))
        for (const record of array(object(scope).logRecords)) add(attrs, record);
    }
  }
  if (config === CLAUDE_CONFIG_ID && envelope.signal === "metrics") {
    for (const raw of array(payload.resourceMetrics)) {
      const resource = object(raw);
      const attrs = attributes(object(resource.resource).attributes);
      for (const scope of array(resource.scopeMetrics))
        for (const rawMetric of array(object(scope).metrics)) {
          const metric = object(rawMetric);
          for (const kind of ["sum", "gauge", "histogram"])
            for (const point of array(object(metric[kind]).dataPoints)) add(attrs, point);
        }
    }
  }
  return [...ids];
}

function timestamp(value: unknown): string | undefined {
  try {
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    const nanos = BigInt(value);
    return nanos > 0n ? new Date(Number(nanos / 1_000_000n)).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

function eventTimestamp(value: string | undefined): string | undefined {
  if (!value || !/(Z|[+-]\d\d:\d\d)$/i.test(value)) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

/** Keep only supported facts for the requested session. Original capture files are not changed. */
export function selectTransfers(
  line: string,
  options: SyncOptions,
  identity: Identity
): Transfer[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error("Capture contains invalid JSON; sync stopped.");
  }
  const envelope = object(parsed);
  const payload = object(envelope.payload);
  const out: Transfer[] = [];
  const sessionKey = options.config === CLAUDE_CONFIG_ID ? "session.id" : "conversation.id";
  if (envelope.signal === "logs") {
    for (const rawResource of array(payload.resourceLogs)) {
      const resource = object(rawResource);
      const resourceAttrs = attributes(object(resource.resource).attributes);
      for (const rawScope of array(resource.scopeLogs)) {
        for (const rawRecord of array(object(rawScope).logRecords)) {
          const record = object(rawRecord);
          const a = merge(resourceAttrs, attributes(record.attributes));
          if (a.get(sessionKey) !== options.session) continue;
          captureIdentity(identity, a);
          const event = a.get("event.name") ?? String(object(record.body).stringValue ?? "");
          const wanted =
            options.config === CLAUDE_CONFIG_ID
              ? event === "tool_result" || event === "claude_code.tool_result"
              : CODEX_EVENTS.has(event) &&
                (event !== "codex.sse_event" || a.get("event.kind") === "response.completed");
          if (!wanted) continue;
          a.set("event.name", event);
          const at =
            options.config === CODEX_CONFIG_ID
              ? (eventTimestamp(a.get("event.timestamp")) ??
                timestamp(record.timeUnixNano ?? record.observedTimeUnixNano))
              : timestamp(record.timeUnixNano ?? record.observedTimeUnixNano);
          if (options.config === CODEX_CONFIG_ID) {
            if (at) a.set("event.timestamp", at);
            else a.delete("event.timestamp");
          }
          out.push({
            signal: "logs",
            at,
            payload: {
              resourceLogs: [
                {
                  scopeLogs: [
                    { logRecords: [{ ...timeOf(record), attributes: safeAttributes(a) }] },
                  ],
                },
              ],
            },
          });
        }
      }
    }
  }
  if (options.config === CLAUDE_CONFIG_ID && envelope.signal === "metrics") {
    for (const rawResource of array(payload.resourceMetrics)) {
      const resource = object(rawResource);
      const resourceAttrs = attributes(object(resource.resource).attributes);
      for (const rawScope of array(resource.scopeMetrics)) {
        for (const rawMetric of array(object(rawScope).metrics)) {
          const metric = object(rawMetric);
          if (typeof metric.name !== "string" || !CLAUDE_METRICS.has(metric.name)) continue;
          for (const kind of ["sum", "gauge", "histogram"]) {
            const aggregation = object(metric[kind]);
            for (const rawPoint of array(aggregation.dataPoints)) {
              const point = object(rawPoint);
              const a = merge(resourceAttrs, attributes(point.attributes));
              if (a.get(sessionKey) !== options.session) continue;
              captureIdentity(identity, a);
              const sanitized = {
                ...numericFields(point, [
                  "startTimeUnixNano",
                  "timeUnixNano",
                  "asInt",
                  "asDouble",
                  "count",
                  "sum",
                  "bucketCounts",
                  "explicitBounds",
                  "min",
                  "max",
                  "flags",
                ]),
                attributes: safeAttributes(a),
              };
              out.push({
                signal: "metrics",
                at: timestamp(point.timeUnixNano),
                start: timestamp(point.startTimeUnixNano),
                payload: {
                  resourceMetrics: [
                    {
                      scopeMetrics: [
                        {
                          metrics: [
                            {
                              name: metric.name,
                              [kind]: {
                                ...numericFields(aggregation, ["aggregationTemporality"]),
                                ...([
                                  "AGGREGATION_TEMPORALITY_CUMULATIVE",
                                  "AGGREGATION_TEMPORALITY_DELTA",
                                ].includes(String(aggregation.aggregationTemporality))
                                  ? { aggregationTemporality: aggregation.aggregationTemporality }
                                  : {}),
                                ...(typeof aggregation.isMonotonic === "boolean"
                                  ? { isMonotonic: aggregation.isMonotonic }
                                  : {}),
                                dataPoints: [sanitized],
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              });
            }
          }
        }
      }
    }
  }
  return out;
}

export function destination(options: SyncOptions, signal: "logs" | "metrics"): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(options.endpoint);
  } catch {
    throw new Error("Endpoint must be a loopback HTTP origin.");
  }
  if (
    endpoint.protocol !== "http:" ||
    !["127.0.0.1", "[::1]"].includes(endpoint.hostname) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== "/" ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error("Endpoint must be a loopback HTTP origin.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.tenant) || options.tenant.length > 63) {
    throw new Error("Tenant must be a valid slug.");
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(options.session)) throw new Error("Session ID is invalid.");
  if (!options.token || /[\r\n]/.test(options.token))
    throw new Error("AIDD_OTEL_TOKEN is required.");
  const provider = options.config === CODEX_CONFIG_ID ? `${CODEX_CONFIG_ID}/` : "";
  return new URL(`/api/kpi/otel/${provider}${options.tenant}/v1/${signal}`, endpoint);
}

class RetryableDeliveryError extends Error {}

export async function send(options: SyncOptions, transfer: Transfer): Promise<void> {
  const body = JSON.stringify(transfer.payload);
  if (Buffer.byteLength(body) > MAX_PAYLOAD)
    throw new Error("An OTLP observation exceeds the receiver's 2 MiB limit.");
  const url = destination(options, transfer.signal);
  let backoff = options.intervalMs ?? 1000;
  for (;;) {
    try {
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
          headers: { authorization: `Bearer ${options.token}`, "content-type": "application/json" },
          body,
        });
      } catch {
        throw new RetryableDeliveryError("Gouvernail could not be reached or timed out.");
      }
      if (!response.ok) {
        const message = `Gouvernail rejected ${options.config} ${transfer.signal}: HTTP ${response.status}.`;
        if (response.status >= 500) throw new RetryableDeliveryError(message);
        throw new Error(message);
      }
      return;
    } catch (error) {
      if (!options.follow || !(error instanceof RetryableDeliveryError) || options.signal?.aborted)
        throw error;
      console.error(`${error.message} Retrying in ${backoff} ms.`);
      await delay(backoff, undefined, { signal: options.signal });
      backoff = Math.min(backoff * 2, 30_000);
    }
  }
}

export interface BindingDetails {
  readonly session: string;
  readonly identity: Array<[string, string]>;
  readonly binding: string;
  readonly conflict?: boolean;
}

export async function readBindingDetails(
  path: string
): Promise<{ mayHaveLinked: boolean; details: BindingDetails | null } | null> {
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
      throw new Error("Sync state must be a private regular file.");
    const parsed: unknown = JSON.parse(await file.readFile("utf8"));
    const data = object(parsed);
    if (typeof data.mayHaveLinked !== "boolean") throw new Error("Sync binding state is invalid.");
    if (data.session === undefined && data.identity === undefined && data.binding === undefined)
      return { mayHaveLinked: data.mayHaveLinked, details: null };
    if (
      typeof data.session !== "string" ||
      typeof data.binding !== "string" ||
      !Array.isArray(data.identity) ||
      !data.identity.every(
        (item: unknown) =>
          Array.isArray(item) &&
          item.length === 2 &&
          ["user.email", "user.account_id", "organization.id"].includes(item[0]) &&
          typeof item[1] === "string"
      )
    )
      throw new Error("Sync binding state is invalid.");
    if (data.conflict !== undefined && typeof data.conflict !== "boolean")
      throw new Error("Sync binding state is invalid.");
    return {
      mayHaveLinked: data.mayHaveLinked,
      details: {
        session: data.session,
        identity: data.identity as Array<[string, string]>,
        binding: data.binding,
        conflict: data.conflict === true,
      },
    };
  } finally {
    await file.close();
  }
}

export async function saveBindingState(
  path: string,
  directory: string,
  details?: BindingDetails,
  mayHaveLinked = true
): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || (info.mode & 0o077) !== 0)
    throw new Error("Sync state directory must be private.");
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify({ mayHaveLinked, ...details })}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export function bindingTransfer(
  options: SyncOptions,
  identity: Identity,
  state: FeatureState
): Transfer | null {
  if (
    (identity.conflict && state.state === "confirmed") ||
    (!identity.values.get("user.email") && !identity.values.get("user.account_id"))
  )
    return null;
  if (options.config === CLAUDE_CONFIG_ID && !identity.values.get("user.email")) return null;
  const a = new Map(identity.values);
  a.set(options.config === CLAUDE_CONFIG_ID ? "session.id" : "conversation.id", options.session);
  a.set(
    "event.name",
    state.state === "confirmed" ? "aidd.session_feature" : "aidd.session_feature_invalidated"
  );
  a.set("event.timestamp", new Date().toISOString());
  if (state.state === "confirmed") {
    a.set("aidd.feature", state.feature);
    a.set("aidd.branch", state.branch);
  }
  const bindingAttrs = [...a].map(([key, value]) => ({ key, value: { stringValue: value } }));
  return {
    signal: "logs",
    payload: {
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: [
                {
                  timeUnixNano: (BigInt(Date.now()) * 1_000_000n).toString(),
                  attributes: bindingAttrs,
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

/** Replays one selected session and optionally follows newly appended bytes. A failed delivery
 * never advances the in-memory cursor. Restart safely replays into the idempotent receiver. */
export async function syncOtel(
  options: SyncOptions,
  resolve: () => Promise<FeatureState>,
  permits: (transfer: Transfer) => Promise<boolean>
) {
  destination(options, "logs");
  const path = join(options.home, ".local/share/aidd-otel-observation", `${options.config}.jsonl`);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const identity: Identity = { values: new Map(), conflict: false };
  let sent = 0;
  let skipped = 0;
  let offset = 0;
  let pending = Buffer.alloc(0);
  let binding = "";
  let needsReplay = false;
  const stateName = createHash("sha256")
    .update(`${options.endpoint}\0${options.tenant}\0${options.config}\0${options.session}`)
    .digest("hex");
  const statePath = options.stateDir
    ? join(options.stateDir, "otel-sync", `${stateName}.json`)
    : null;
  let mayHaveLinked = false;
  try {
    const info = await handle.stat();
    if (!info.isFile() || (info.mode & 0o077) !== 0)
      throw new Error("Capture must be a private regular file.");
    if (statePath !== null) {
      const saved = await readBindingDetails(statePath);
      mayHaveLinked = saved?.mayHaveLinked === true;
      if (saved?.details) {
        if (saved.details.session !== options.session)
          throw new Error("Sync binding state does not match its session.");
        for (const [key, value] of saved.details.identity) identity.values.set(key, value);
        identity.conflict = saved.details.conflict === true;
        binding = saved.details.binding;
        needsReplay = mayHaveLinked && binding !== "invalidated";
      }
    }
    const buffer = Buffer.alloc(65536);
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset + pending.length);
      if (bytesRead > 0) {
        pending = Buffer.concat([pending, buffer.subarray(0, bytesRead)]);
        if (pending.length > MAX_LINE) throw new Error("Capture line exceeds 32 MiB.");
        for (let newline = pending.indexOf(10); newline >= 0; newline = pending.indexOf(10)) {
          const line = pending.subarray(0, newline).toString("utf8");
          if (line.trim()) {
            const admitted: Transfer[] = [];
            const verdicts = new Map<string, boolean>();
            for (const transfer of selectTransfers(line, options, identity)) {
              if (!transfer.at || (transfer.signal === "metrics" && !transfer.start)) {
                skipped++;
                continue;
              }
              const stamp = `${transfer.at}\0${transfer.start ?? ""}`;
              let allowed = verdicts.get(stamp);
              if (allowed === undefined) {
                allowed = await permits(transfer);
                verdicts.set(stamp, allowed);
              }
              if (!allowed) {
                skipped++;
                continue;
              }
              admitted.push(transfer);
            }
            for (const batch of packTransfers(admitted)) {
              await send(options, batch.transfer);
              sent += batch.count;
            }
          }
          offset += newline + 1;
          pending = pending.subarray(newline + 1);
        }
        continue;
      }
      const current = await lstat(path);
      if (
        !current.isFile() ||
        current.ino !== info.ino ||
        current.dev !== info.dev ||
        current.size < offset + pending.length
      ) {
        throw new Error("Capture was replaced or truncated; restart sync to replay it safely.");
      }
      const feature = await resolve();
      const nextBinding =
        feature.state === "confirmed" ? `${feature.branch}\0${feature.feature}` : feature.state;
      const shouldInvalidate =
        mayHaveLinked &&
        (identity.conflict ||
          feature.state !== "confirmed" ||
          (binding !== "" && binding !== nextBinding));
      const bindingAllowed = await permits({
        signal: "logs",
        payload: {},
        at: new Date().toISOString(),
      });
      if (bindingAllowed && shouldInvalidate && binding !== "invalidated") {
        const event = bindingTransfer(options, identity, { state: "ambiguous" });
        if (event) {
          await send(options, event);
          sent++;
          binding = "invalidated";
          if (statePath !== null)
            await saveBindingState(statePath, join(options.stateDir ?? "", "otel-sync"), {
              session: options.session,
              identity: [...identity.values],
              binding,
            });
        }
      } else if (
        bindingAllowed &&
        !shouldInvalidate &&
        feature.state === "confirmed" &&
        (nextBinding !== binding || needsReplay)
      ) {
        const event = bindingTransfer(options, identity, feature);
        if (event) {
          if (statePath !== null) {
            await saveBindingState(statePath, join(options.stateDir ?? "", "otel-sync"), {
              session: options.session,
              identity: [...identity.values],
              binding: nextBinding,
            });
          }
          mayHaveLinked = true;
          await send(options, event);
          sent++;
          binding = nextBinding;
          needsReplay = false;
        }
      }
      if (!options.follow || options.signal?.aborted)
        return { sent, skipped, offset, partialLine: pending.length > 0 };
      try {
        await delay(options.intervalMs ?? INTERVAL_MS, undefined, { signal: options.signal });
      } catch (error) {
        if (options.signal?.aborted)
          return { sent, skipped, offset, partialLine: pending.length > 0 };
        throw error;
      }
    }
  } finally {
    await handle.close();
  }
}
