import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import { asPlainObject } from "../../../../../kernel/reading/plain-object.js";
import { type SessionFeature, sameSessionFeature } from "../../../domain/report/session-feature.js";
import { CLAUDE_CONFIG_ID, CODEX_CONFIG_ID, type SyncConfig } from "../settings.js";
import { createSessionProjectPublisher } from "./metadata/session-project.js";
import { createSessionRepositoryPublisher } from "./metadata/session-repository.js";
import { createSessionTitlePublisher } from "./metadata/session-title.js";
import { readAttributeValue } from "./read-attribute-value.js";
import { seriesFingerprint } from "./series-fingerprint.js";

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
  readonly includeSessionTitles?: boolean;
  readonly includeSessionProjects?: boolean;
  readonly includeSessionRepositories?: boolean;
  readonly onProjectUnavailable?: () => void;
  readonly onRepositoryUnavailable?: () => void;
  readonly onTitleUnavailable?: () => void;
  readonly titlesOnly?: boolean;
  readonly admission?: { readonly cwd: string; readonly repositoryId: string };
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

export interface Identity {
  readonly values: Map<string, string>;
  conflict: boolean;
}

export interface IdentityEvidence {
  readonly keys: string[];
  readonly at: string;
  readonly start?: string;
}

export function admissionFingerprint(admission: {
  cwd: string | null;
  repositoryId: string | null;
}): string {
  return createHash("sha256")
    .update(JSON.stringify([admission.cwd, admission.repositoryId]))
    .digest("hex");
}

export function evidenceTransfers(evidence: readonly IdentityEvidence[]): Transfer[] {
  return evidence.map(({ at, start }) => ({
    signal: start ? "metrics" : "logs",
    payload: {},
    at,
    start,
  }));
}

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

function captureIdentity(target: Identity, values: Map<string, string>) {
  for (const key of IDENTITY_ATTRIBUTES) {
    const value = values.get(key);
    if (!value) continue;
    const existing = target.values.get(key);
    if (existing !== undefined && existing !== value) target.conflict = true;
    else target.values.set(key, value);
  }
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

/** Each item was separately consent-checked. Only points at the same instant and from the
 * same session are combined, with a hard upper bound matching the receiver. */
export function packTransfers(
  transfers: readonly Transfer[]
): Array<{ transfer: Transfer; count: number; items: Transfer[] }> {
  const groups = new Map<string, Array<{ transfer: Transfer; count: number; items: Transfer[] }>>();
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
        attributes(object(object(rawScope).scope).attributes);
        for (const rawRecord of array(object(rawScope).logRecords)) {
          const record = object(rawRecord);
          const a = merge(resourceAttrs, attributes(record.attributes));
          if (a.get(sessionKey) !== options.session) continue;
          captureIdentity(identity, a);
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
              const a = merge(resourceAttrs, attributes(point.attributes));
              if (a.get(sessionKey) !== options.session) continue;
              captureIdentity(identity, a);
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
              const sanitized = {
                ...numericFields(point, METRIC_POINT_FIELDS),
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

/** Only a consent-admitted transfer can contribute identity to later metadata. */
export function admitTransferIdentity(
  transfer: Transfer,
  options: SyncOptions,
  identity: Identity
): void {
  selectTransfers(
    JSON.stringify({ signal: transfer.signal, payload: transfer.payload }),
    options,
    identity
  );
}

export function observeIdentity(
  transfer: Transfer,
  options: SyncOptions,
  identity: Identity,
  evidence: IdentityEvidence[]
): void {
  const previous = new Map(identity.values);
  const conflicted = identity.conflict;
  admitTransferIdentity(transfer, options, identity);
  const keys = [...identity.values]
    .filter(([key, value]) => previous.get(key) !== value)
    .map(([key]) => key);
  if ((keys.length || conflicted !== identity.conflict) && transfer.at)
    evidence.push({ keys, at: transfer.at, ...(transfer.start ? { start: transfer.start } : {}) });
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

export interface BindingDetails {
  readonly session: string;
  readonly identity: Array<[string, string]>;
  readonly binding: string;
  readonly conflict?: boolean;
  readonly identityProof?: {
    readonly version: 1;
    readonly admissionKey: string;
    readonly sources: IdentityEvidence[];
  };
}

function readIdentityProof(
  value: unknown,
  identity: Array<[string, string]>
): BindingDetails["identityProof"] {
  const proof = object(value);
  if (
    proof.version !== 1 ||
    typeof proof.admissionKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(proof.admissionKey) ||
    !Array.isArray(proof.sources) ||
    proof.sources.length === 0 ||
    proof.sources.length > 4
  )
    return undefined;
  const keys = new Set(identity.map(([key]) => key));
  const seen = new Set<string>();
  const sources: IdentityEvidence[] = [];
  for (const raw of proof.sources) {
    const source = object(raw);
    if (
      !Array.isArray(source.keys) ||
      new Set(source.keys).size !== source.keys.length ||
      !source.keys.every(
        (key: unknown) => typeof key === "string" && keys.has(key) && !seen.has(key)
      ) ||
      typeof source.at !== "string" ||
      !Number.isFinite(Date.parse(source.at)) ||
      (source.start !== undefined &&
        (typeof source.start !== "string" ||
          !Number.isFinite(Date.parse(source.start)) ||
          Date.parse(source.start) > Date.parse(source.at)))
    )
      return undefined;
    for (const key of source.keys) seen.add(key);
    sources.push({
      keys: source.keys as string[],
      at: source.at,
      ...(typeof source.start === "string" ? { start: source.start } : {}),
    });
  }
  if (seen.size !== keys.size || keys.size === 0) return undefined;
  return { version: 1, admissionKey: proof.admissionKey, sources };
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
    if (
      new Set(data.identity.map((item: [string, string]) => item[0])).size !== data.identity.length
    )
      throw new Error("Sync binding state is invalid.");
    if (data.conflict !== undefined && typeof data.conflict !== "boolean")
      throw new Error("Sync binding state is invalid.");
    const identity = data.identity as Array<[string, string]>;
    const identityProof = readIdentityProof(data.identityProof, identity);
    return {
      mayHaveLinked: data.mayHaveLinked,
      details: {
        session: data.session,
        identity: identityProof ? identity : [],
        identityProof,
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
    await writeFile(
      temporary,
      `${JSON.stringify({ mayHaveLinked, ...details, identity: details?.identityProof ? details.identity : [] })}\n`,
      {
        flag: "wx",
        mode: 0o600,
      }
    );
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
  const at = new Date().toISOString();
  a.set("event.timestamp", at);
  if (state.state === "confirmed") {
    a.set("aidd.feature", state.feature);
    a.set("aidd.branch", state.branch);
  }
  const bindingAttrs = [...a].map(([key, value]) => ({ key, value: { stringValue: value } }));
  return {
    signal: "logs",
    at,
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
  if (
    options.titlesOnly &&
    (options.config !== CODEX_CONFIG_ID || options.follow || !options.includeSessionTitles)
  )
    throw new Error("Title-only sync requires one Codex session and title opt-in.");
  destination(options, "logs");
  const path = join(options.home, ".local/share/aidd-otel-observation", `${options.config}.jsonl`);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const identity: Identity = { values: new Map(), conflict: false };
  const identityEvidence: IdentityEvidence[] = [];
  const stillPermitted = async (items: readonly Transfer[], expectedFeature?: SessionFeature) => {
    const currentFeature = await resolve();
    if (expectedFeature && !sameSessionFeature(expectedFeature, currentFeature)) return false;
    const consentAt = new Date().toISOString();
    for (const item of items) if (!(await permits({ ...item, consentAt }))) return false;
    return true;
  };
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
  let previousLinkUnverified = false;
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
  try {
    const info = await handle.stat();
    if (!info.isFile() || (info.mode & 0o077) !== 0)
      throw new Error("Capture must be a private regular file.");
    if (statePath !== null) {
      const saved = await readBindingDetails(statePath);
      mayHaveLinked = saved?.mayHaveLinked === true;
      previousLinkUnverified = mayHaveLinked;
      if (saved?.details) {
        if (saved.details.session !== options.session)
          throw new Error("Sync binding state does not match its session.");
        const proof = saved.details.identityProof;
        if (
          proof &&
          options.admission &&
          proof.admissionKey === admissionFingerprint(options.admission) &&
          (await stillPermitted(evidenceTransfers(proof.sources)))
        ) {
          for (const [key, value] of saved.details.identity) identity.values.set(key, value);
          identityEvidence.push(...proof.sources);
          previousLinkUnverified = false;
        }
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
            const scratch: Identity = { values: new Map(), conflict: false };
            for (const transfer of selectTransfers(line, options, scratch)) {
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
              observeIdentity(transfer, options, identity, identityEvidence);
            }
            if (!options.titlesOnly)
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
      if (
        !previousLinkUnverified &&
        !options.titlesOnly &&
        bindingAllowed &&
        shouldInvalidate &&
        binding !== "invalidated"
      ) {
        const event = bindingTransfer(options, identity, { state: "ambiguous" });
        if (event) {
          await send(options, event, () =>
            stillPermitted([event, ...evidenceTransfers(identityEvidence)], feature)
          );
          sent++;
          binding = "invalidated";
          if (statePath !== null)
            await saveBindingState(statePath, join(options.stateDir ?? "", "otel-sync"), {
              session: options.session,
              identity: [...identity.values],
              binding,
              ...(options.admission && identityEvidence.length
                ? {
                    identityProof: {
                      version: 1,
                      admissionKey: admissionFingerprint(options.admission),
                      sources: identityEvidence,
                    },
                  }
                : {}),
            });
        }
      } else if (
        bindingAllowed &&
        !previousLinkUnverified &&
        !options.titlesOnly &&
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
              ...(options.admission && identityEvidence.length
                ? {
                    identityProof: {
                      version: 1,
                      admissionKey: admissionFingerprint(options.admission),
                      sources: identityEvidence,
                    },
                  }
                : {}),
            });
          }
          mayHaveLinked = true;
          await send(options, event, () =>
            stillPermitted([event, ...evidenceTransfers(identityEvidence)], feature)
          );
          sent++;
          binding = nextBinding;
          needsReplay = false;
        }
      }
      if (bindingAllowed)
        for (const publisher of [titles, projects, repositories]) {
          if (
            publisher &&
            (await publisher.publish(options.session, identity, async (event) => {
              if (!(await permits(event))) return false;
              await send(options, event, () =>
                stillPermitted([event, ...evidenceTransfers(identityEvidence)])
              );
              return true;
            }))
          )
            sent++;
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
    titles?.close();
    projects?.close();
    repositories?.close();
    await handle.close();
  }
}
