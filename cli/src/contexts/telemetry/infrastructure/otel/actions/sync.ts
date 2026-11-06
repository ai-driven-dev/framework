import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import { asPlainObject } from "../../../../../kernel/reading/plain-object.js";
import { CLAUDE_CONFIG_ID, CODEX_CONFIG_ID, type SyncConfig } from "../settings.js";
import { readAttributeValue } from "./read-attribute-value.js";
import { seriesFingerprint } from "./series-fingerprint.js";

export interface SyncOptions {
  readonly config: SyncConfig;
  readonly session: string;
  readonly tenant: string;
  readonly endpoint: string;
  readonly token: string;
  readonly home: string;
  readonly follow: boolean;
  readonly signal?: AbortSignal;
  readonly intervalMs?: number;
}

type RecordObject = Record<string, unknown>;
const object = (value: unknown): RecordObject => asPlainObject(value) ?? {};
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const MAX_PAYLOAD = 2 * 1024 * 1024;
const MAX_LINE = 32 * 1024 * 1024;

export class OtelObservationTooLargeError extends Error {
  constructor() {
    super("An OTLP observation exceeds the receiver's 2 MiB limit.");
  }
}
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
const IDENTITY_ATTRIBUTES = new Set(["user.email", "user.account_id", "organization.id"]);
const NON_TEXT_ATTRIBUTES = new Set([
  "event.sequence",
  "success",
  "duration_ms",
  "input_token_count",
  "output_token_count",
  "cached_token_count",
  "cache_write_token_count",
  "reasoning_token_count",
]);
const METRIC_DATA_FIELDS = [
  "sum",
  "gauge",
  "histogram",
  "exponentialHistogram",
  "exponential_histogram",
  "summary",
];
const METRIC_POINT_FIELDS = [
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
];
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
  "aidd.original_event_timestamp",
  "tool_use_id",
  "type",
  "model",
  "tool_name",
  "tool",
  "decision",
  "query_source",
  "aidd.series_fingerprint",
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

function attributes(value: unknown): Map<string, string> {
  if (value !== undefined && !Array.isArray(value)) throw new Error("Invalid OTLP attributes.");
  const out = new Map<string, string>();
  const seen = new Map<string, unknown>();
  for (const item of array(value)) {
    const entry = object(item);
    if (typeof entry.key === "string") {
      if (seen.has(entry.key) && !isDeepStrictEqual(seen.get(entry.key), entry.value))
        throw new Error("Conflicting duplicate OTLP attributes.");
      seen.set(entry.key, entry.value);
    }
    if (typeof entry.key === "string") {
      const critical = SAFE_ATTRIBUTES.has(entry.key);
      if (
        critical &&
        !NON_TEXT_ATTRIBUTES.has(entry.key) &&
        typeof object(entry.value).stringValue !== "string"
      )
        throw new Error("Invalid OTLP attribute value.");
      const raw = readAttributeValue(entry.value, critical);
      if (
        raw === "" &&
        ["event.name", "event.kind", "session.id", "conversation.id"].includes(entry.key)
      )
        throw new Error("Invalid OTLP attribute value.");
      if (raw !== undefined) out.set(entry.key, raw);
    }
  }
  return out;
}

function merge(...maps: Map<string, string>[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const map of maps) {
    for (const [key, value] of map) {
      const previous = out.get(key);
      if (IDENTITY_ATTRIBUTES.has(key) && previous !== undefined && previous !== value)
        throw new Error("Conflicting OTLP identity attributes.");
      out.set(key, value);
    }
  }
  return out;
}

function safeAttributes(values: Map<string, string>) {
  return [...values]
    .filter(([key]) => SAFE_ATTRIBUTES.has(key))
    .map(([key, value]) => ({
      key,
      value: { stringValue: value },
    }));
}

function eventNameFromBody(body: unknown): string {
  if (body === undefined) return "";
  if (typeof object(body).stringValue !== "string")
    throw new Error("Invalid OTLP attribute value.");
  const value = readAttributeValue(body, true);
  if (!value) throw new Error("Invalid OTLP attribute value.");
  return value;
}

function numericFields(source: RecordObject, keys: readonly string[]): RecordObject {
  const result: RecordObject = {};
  for (const key of keys) {
    const value = source[key];
    if (value === undefined) continue;
    validateIntegerField(key, value);
    if (["asDouble", "sum", "min", "max"].includes(key) && !isFiniteDouble(value))
      throw new Error("Invalid OTLP numeric field.");
    if (key === "explicitBounds" && (!Array.isArray(value) || !value.every(isFiniteDouble)))
      throw new Error("Invalid OTLP numeric field.");
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

function isFiniteDouble(value: unknown): boolean {
  return (
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)))
  );
}

function metricKind(metric: RecordObject): "sum" | "gauge" | "histogram" {
  const fields = METRIC_DATA_FIELDS.filter((key) => metric[key] !== undefined);
  const kind = fields.at(0);
  if (fields.length !== 1 || (kind !== "sum" && kind !== "gauge" && kind !== "histogram"))
    throw new Error("Invalid or unsupported OTLP metric data.");
  const data = asPlainObject(metric[kind]);
  if (!data || (data.dataPoints !== undefined && !Array.isArray(data.dataPoints)))
    throw new Error("Invalid or unsupported OTLP metric data.");
  return kind;
}

function validateMetricPoint(point: RecordObject, kind: string): void {
  const values = Number(point.asInt !== undefined) + Number(point.asDouble !== undefined);
  if ((kind === "histogram" && values !== 0) || (kind !== "histogram" && values !== 1))
    throw new Error("Invalid OTLP metric point value.");
  numericFields(point, METRIC_POINT_FIELDS);
  if (point.flags !== undefined && (BigInt(String(point.flags)) & 1n) !== 0n)
    throw new Error("OTLP metric point has no recorded value.");
}

function isExactInteger(value: unknown, minimum: bigint, maximum: bigint): boolean {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return false;
  if (typeof value !== "number" && (typeof value !== "string" || !/^-?\d{1,20}$/.test(value)))
    return false;
  const integer = BigInt(value);
  return integer >= minimum && integer <= maximum;
}

function validateIntegerField(key: string, value: unknown): void {
  const unsigned64 = 18446744073709551615n;
  let valid = true;
  if (["startTimeUnixNano", "timeUnixNano", "observedTimeUnixNano", "count"].includes(key))
    valid = isExactInteger(value, 0n, unsigned64);
  else if (key === "asInt")
    valid = isExactInteger(value, -9223372036854775808n, 9223372036854775807n);
  else if (key === "flags") valid = isExactInteger(value, 0n, 4294967295n);
  else if (key === "bucketCounts")
    valid = Array.isArray(value) && value.every((item) => isExactInteger(item, 0n, unsigned64));
  if (!valid) throw new Error(`Invalid OTLP integer field: ${key}.`);
}

function isExactNanoseconds(value: unknown): value is string | number {
  return isExactInteger(value, 0n, 18446744073709551615n);
}

function timeOf(entry: RecordObject) {
  for (const key of ["timeUnixNano", "observedTimeUnixNano"]) {
    if (entry[key] !== undefined) validateIntegerField(key, entry[key]);
  }
  return {
    ...(isExactNanoseconds(entry.timeUnixNano) ? { timeUnixNano: entry.timeUnixNano } : {}),
    ...(isExactNanoseconds(entry.observedTimeUnixNano)
      ? { observedTimeUnixNano: entry.observedTimeUnixNano }
      : {}),
  };
}

export interface Transfer {
  readonly signal: "logs" | "metrics";
  readonly payload: RecordObject;
  readonly at?: string;
  readonly start?: string;
  /** When set, the same clone must also consent at this instant. Never sent. */
  readonly consentAt?: string;
}

/** Each item was separately consent-checked. The receiver's size limit remains mandatory. */
export function packTransfers(
  transfers: readonly Transfer[],
  groupByTimestamp = true
): Array<{ transfer: Transfer; count: number; items: Transfer[] }> {
  const groups = new Map<string, Array<{ transfer: Transfer; count: number; items: Transfer[] }>>();
  for (const item of transfers) {
    const key = groupByTimestamp ? `${item.signal}\0${item.at ?? ""}` : item.signal;
    const root = item.signal === "logs" ? "resourceLogs" : "resourceMetrics";
    const resources = array(item.payload[root]);
    const batches = groups.get(key) ?? [];
    const last = batches.at(-1);
    const merged = last ? [...array(last.transfer.payload[root]), ...resources] : resources;
    const body = { [root]: merged };
    if (Buffer.byteLength(JSON.stringify(body)) > MAX_PAYLOAD) {
      if (Buffer.byteLength(JSON.stringify(item.payload)) > MAX_PAYLOAD)
        throw new OtelObservationTooLargeError();
      batches.push({ transfer: item, count: 1, items: [item] });
    } else if (last) {
      batches[batches.length - 1] = {
        transfer: { ...last.transfer, payload: body },
        count: last.count + 1,
        items: [...last.items, item],
      };
    } else {
      batches.push({ transfer: item, count: 1, items: [item] });
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
      for (const scope of array(resource.scopeLogs)) {
        attributes(object(object(scope).scope).attributes);
        for (const record of array(object(scope).logRecords)) add(attrs, record);
      }
    }
  }
  if (config === CLAUDE_CONFIG_ID && envelope.signal === "metrics") {
    for (const raw of array(payload.resourceMetrics)) {
      const resource = object(raw);
      const attrs = attributes(object(resource.resource).attributes);
      for (const scope of array(resource.scopeMetrics)) {
        attributes(object(object(scope).scope).attributes);
        for (const rawMetric of array(object(scope).metrics)) {
          const metric = object(rawMetric);
          if (typeof metric.name !== "string" || !CLAUDE_METRICS.has(metric.name)) continue;
          for (const kind of [metricKind(metric)])
            for (const point of array(object(metric[kind]).dataPoints)) {
              validateMetricPoint(object(point), kind);
              add(attrs, point);
            }
        }
      }
    }
  }
  return [...ids];
}

function timestamp(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!isExactNanoseconds(value)) throw new Error("Invalid OTLP integer field: timeUnixNano.");
  try {
    const nanos = BigInt(value);
    return nanos > 0n ? new Date(Number(nanos / 1_000_000n)).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

function eventTimestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date =
    /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.exec(
      value
    )?.[1];
  if (!date) return undefined;
  const calendar = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(calendar.getTime()) || !calendar.toISOString().startsWith(`${date}T`))
    return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

/** Keep only supported facts for the requested session. Original capture files are not changed. */
export function selectTransfers(line: string, options: SyncOptions): Transfer[] {
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
        attributes(object(object(rawScope).scope).attributes);
        for (const rawRecord of array(object(rawScope).logRecords)) {
          const record = object(rawRecord);
          const a = merge(resourceAttrs, attributes(record.attributes));
          if (a.get(sessionKey) !== options.session) continue;
          const event = a.get("event.name") ?? eventNameFromBody(record.body);
          const wanted =
            options.config === CLAUDE_CONFIG_ID
              ? event === "tool_result" || event === "claude_code.tool_result"
              : CODEX_EVENTS.has(event) &&
                (event !== "codex.sse_event" || a.get("event.kind") === "response.completed");
          if (!wanted) continue;
          a.set("event.name", event);
          const at =
            options.config === CODEX_CONFIG_ID
              ? (eventTimestamp(a.get("event.timestamp")) ?? timestamp(record.timeUnixNano))
              : timestamp(record.timeUnixNano);
          if (options.config === CODEX_CONFIG_ID) {
            const originalTimestamp = a.get("event.timestamp");
            a.delete("aidd.original_event_timestamp");
            if (originalTimestamp && eventTimestamp(originalTimestamp))
              a.set("aidd.original_event_timestamp", originalTimestamp);
            if (at) a.set("event.timestamp", at);
            else a.delete("event.timestamp");
          }
          const safe = safeAttributes(a);
          if (options.config === CODEX_CONFIG_ID && event !== "codex.tool_result") {
            const key =
              event === "codex.conversation_starts" ? "reasoning_effort" : "model_reasoning_effort";
            const entries = array(record.attributes).map(object);
            const source = entries.find((entry) => entry.key === key);
            const model = object(entries.find((entry) => entry.key === "model")?.value).stringValue;
            const value = object(source?.value).stringValue;
            if (
              typeof model === "string" &&
              model.trim() &&
              typeof value === "string" &&
              /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(value)
            )
              safe.push({ key, value: { stringValue: value } });
          }
          out.push({
            signal: "logs",
            at,
            payload: {
              resourceLogs: [
                {
                  scopeLogs: [{ logRecords: [{ ...timeOf(record), attributes: safe }] }],
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
        attributes(object(object(rawScope).scope).attributes);
        for (const rawMetric of array(object(rawScope).metrics)) {
          const metric = object(rawMetric);
          if (typeof metric.name !== "string" || !CLAUDE_METRICS.has(metric.name)) continue;
          for (const kind of [metricKind(metric)]) {
            const aggregation = object(metric[kind]);
            for (const rawPoint of array(aggregation.dataPoints)) {
              const point = object(rawPoint);
              validateMetricPoint(point, kind);
              const pointAttrs = attributes(point.attributes);
              const a = merge(resourceAttrs, pointAttrs);
              if (a.get(sessionKey) !== options.session) continue;
              a.set(
                "aidd.series_fingerprint",
                seriesFingerprint(
                  resource,
                  {
                    scope: object(rawScope).scope,
                    schemaUrl: object(rawScope).schemaUrl,
                    metric: {
                      name: metric.name,
                      unit: metric.unit,
                      kind,
                      aggregationTemporality: aggregation.aggregationTemporality,
                      isMonotonic: aggregation.isMonotonic,
                    },
                  },
                  point.attributes
                )
              );
              const safe = safeAttributes(a);
              const effort = array(point.attributes)
                .map(object)
                .find((entry) => entry.key === "effort");
              const effortValue = object(effort?.value).stringValue;
              if (
                metric.name === "claude_code.token.usage" &&
                a.get("model")?.trim() &&
                typeof effortValue === "string" &&
                /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(effortValue)
              )
                safe.push({ key: "effort", value: { stringValue: effortValue } });
              const sanitized = {
                ...numericFields(point, METRIC_POINT_FIELDS),
                attributes: safe,
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

export class ConsentNotConfirmedError extends Error {
  constructor() {
    super("Consent is no longer confirmed; sync stopped before sending.");
  }
}

async function assertFullDelivery(response: Response, signal: Transfer["signal"]): Promise<void> {
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error("Gouvernail returned an invalid OTLP response.");
  }
  const envelope = asPlainObject(result);
  if (!envelope) throw new Error("Gouvernail returned an invalid OTLP response.");
  if (Object.keys(envelope).some((key) => key !== "partialSuccess" && key !== "partial_success"))
    throw new Error("Gouvernail returned an invalid OTLP response.");
  if ("partialSuccess" in envelope && "partial_success" in envelope)
    throw new Error("Gouvernail returned an invalid OTLP response.");
  const raw = envelope.partialSuccess ?? envelope.partial_success;
  if (raw === undefined || raw === null) return;
  const partial = asPlainObject(raw);
  if (!partial) throw new Error("Gouvernail returned an invalid OTLP response.");
  const camel = signal === "logs" ? "rejectedLogRecords" : "rejectedDataPoints";
  const snake = signal === "logs" ? "rejected_log_records" : "rejected_data_points";
  if (
    Object.keys(partial).some(
      (key) => ![camel, snake, "errorMessage", "error_message"].includes(key)
    )
  )
    throw new Error("Gouvernail returned an invalid OTLP response.");
  if (camel in partial && snake in partial)
    throw new Error("Gouvernail returned an invalid OTLP response.");
  const count = partial[camel] ?? partial[snake] ?? 0;
  const number =
    typeof count === "string" && /^\d+(?:[eE]\+?\d+)?$/.test(count) ? Number(count) : count;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 0)
    throw new Error("Gouvernail returned an invalid OTLP response.");
  if (number > 0)
    throw new Error(
      `Gouvernail reported partial ${signal} delivery; resolve the rejection before retrying.`
    );
}

export async function send(
  options: SyncOptions,
  transfer: Transfer,
  consent: () => Promise<boolean>
): Promise<void> {
  const body = JSON.stringify(transfer.payload);
  if (Buffer.byteLength(body) > MAX_PAYLOAD)
    throw new Error("An OTLP observation exceeds the receiver's 2 MiB limit.");
  const url = destination(options, transfer.signal);
  let backoff = options.intervalMs ?? 1000;
  for (;;) {
    if (!(await consent())) throw new ConsentNotConfirmedError();
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
      await assertFullDelivery(response, transfer.signal);
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

/** Replays one selected session and optionally follows newly appended bytes. A failed delivery
 * never advances the in-memory cursor. Restart safely replays into the idempotent receiver. */
export async function syncOtel(
  options: SyncOptions,
  revalidate: () => Promise<void>,
  permits: (transfer: Transfer) => Promise<boolean>
) {
  destination(options, "logs");
  const path = join(options.home, ".local/share/aidd-otel-observation", `${options.config}.jsonl`);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const stillPermitted = async (items: readonly Transfer[]) => {
    await revalidate();
    const consentAt = new Date().toISOString();
    for (const item of items) if (!(await permits({ ...item, consentAt }))) return false;
    return true;
  };
  let sent = 0;
  let skipped = 0;
  let offset = 0;
  let pending = Buffer.alloc(0);
  try {
    const info = await handle.stat();
    if (!info.isFile() || (info.mode & 0o077) !== 0)
      throw new Error("Capture must be a private regular file.");
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
            for (const transfer of selectTransfers(line, options)) {
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
              await send(options, batch.transfer, () => stillPermitted(batch.items));
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
