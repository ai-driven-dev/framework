import { asPlainObject } from "../../../../kernel/reading/plain-object.js";
import type {
  JsonValue,
  TelemetryObservation,
} from "../../domain/observations/telemetry-observation.js";
import { CLAUDE_CONFIG_ID, CODEX_CONFIG_ID, type Config, OPENCODE_CONFIG_ID } from "./settings.js";

interface OtelCapture {
  readonly signal: "logs" | "traces" | "metrics";
  readonly payload: unknown;
  readonly received_at?: string;
}
export interface ClaudeTelemetrySource extends OtelCapture {}
export interface CodexTelemetrySource extends OtelCapture {}
export interface OpenCodeV1Source {
  readonly type: string;
  readonly properties: unknown;
}
export interface OpenCodeV2Source {
  readonly type: string;
  readonly data: unknown;
  readonly created?: number;
  readonly location?: unknown;
}
export type OpenCodeTelemetrySource = OpenCodeV1Source | OpenCodeV2Source | OtelCapture;

type Obj = Record<string, unknown>;
function json(value: unknown): JsonValue | undefined {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) return value.map((item) => json(item) ?? null);
  const input = asPlainObject(value);
  if (input === null) return undefined;
  const result: Record<string, JsonValue> = {};
  for (const [key, entry] of Object.entries(input)) {
    const parsed = json(entry);
    if (parsed !== undefined) result[key] = parsed;
  }
  return result;
}
const object = (value: unknown): Obj => asPlainObject(value) ?? {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;
function number(value: unknown): number | undefined {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === ""))
    return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
function bool(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}
function nanos(value: unknown): string | undefined {
  try {
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    const n = BigInt(value);
    if (n <= 0n) return undefined;
    return new Date(Number(n / 1_000_000n)).toISOString();
  } catch {
    return undefined;
  }
}
function millis(value: unknown): string | undefined {
  const n = number(value);
  if (n === undefined) return undefined;
  try {
    return new Date(n).toISOString();
  } catch {
    return undefined;
  }
}
function decodeValue(raw: unknown): unknown {
  const item = object(raw);
  for (const key of ["stringValue", "boolValue", "intValue", "doubleValue"]) {
    if (key in item) return item[key];
  }
  if (item.arrayValue) return list(object(item.arrayValue).values).map(decodeValue);
  if (item.kvlistValue) return attributes(object(item.kvlistValue).values);
  return undefined;
}
function attributes(raw: unknown): Obj {
  const result: Obj = {};
  for (const entry of list(raw)) {
    const item = object(entry);
    const key = text(item.key);
    if (key !== undefined) result[key] = decodeValue(item.value);
  }
  return result;
}
function first<T>(...values: (T | undefined)[]): T | undefined {
  return values.find((item) => item !== undefined);
}
function pickText(attributes: Obj, ...keys: string[]): string | undefined {
  return first(...keys.map((key) => text(attributes[key])));
}
function pickNumber(attributes: Obj, ...keys: string[]): number | undefined {
  return first(...keys.map((key) => number(attributes[key])));
}
function tokens(fields: TelemetryObservation["tokens"]): TelemetryObservation["tokens"] {
  return fields && Object.values(fields).some((item) => item !== undefined) ? fields : undefined;
}
function base(
  tool: TelemetryObservation["tool"],
  signal: TelemetryObservation["signal"],
  a: Obj,
  source: unknown
): TelemetryObservation {
  const usage = tokens({
    input: pickNumber(
      a,
      "input_tokens",
      "input_token_count",
      "codex.turn.token_usage.input_tokens",
      "gen_ai.usage.input_tokens",
      "ai.usage.inputTokens"
    ),
    inputNonCached: pickNumber(
      a,
      "codex.turn.token_usage.non_cached_input_tokens",
      "ai.usage.inputTokenDetails.noCacheTokens"
    ),
    output: pickNumber(
      a,
      "output_tokens",
      "output_token_count",
      "codex.turn.token_usage.output_tokens",
      "gen_ai.usage.output_tokens",
      "ai.usage.outputTokens"
    ),
    cacheRead: pickNumber(
      a,
      "cache_read_tokens",
      "cached_token_count",
      "codex.turn.token_usage.cached_input_tokens",
      "gen_ai.usage.cache_read.input_tokens",
      "ai.usage.cachedInputTokens",
      "ai.usage.inputTokenDetails.cacheReadTokens"
    ),
    cacheWrite: pickNumber(
      a,
      "cache_creation_tokens",
      "cache_write_token_count",
      "codex.turn.token_usage.cache_write_input_tokens",
      "gen_ai.usage.cache_write.input_tokens"
    ),
    cacheWrite5m: number(a.cache_creation_5m_tokens),
    cacheWrite1h: number(a.cache_creation_1h_tokens),
    reasoning: pickNumber(
      a,
      "reasoning_token_count",
      "codex.turn.token_usage.reasoning_output_tokens",
      "codex.usage.reasoning_output_tokens",
      "ai.usage.reasoningTokens",
      "ai.usage.outputTokenDetails.reasoningTokens"
    ),
    total: pickNumber(
      a,
      "codex.turn.token_usage.total_tokens",
      "codex.usage.total_tokens",
      "ai.usage.totalTokens"
    ),
    tool: number(a.tool_token_count),
  });
  return {
    tool,
    signal,
    source: json(source),
    eventType: pickText(a, "event.name"),
    timestamp: pickText(a, "event.timestamp"),
    toolVersion: pickText(a, "app.version", "service.version"),
    sessionId: pickText(a, "session.id", "conversation.id"),
    threadId: text(a["thread.id"]),
    provider: pickText(
      a,
      "anthropic.provider",
      "provider_name",
      "provider",
      "gen_ai.provider.name",
      "gen_ai.system",
      "ai.model.provider"
    ),
    model: pickText(a, "model", "gen_ai.request.model", "ai.model.id"),
    requestId: pickText(a, "request_id", "gen_ai.response.id", "ai.response.id"),
    toolCallId: pickText(a, "tool_use_id", "call_id", "gen_ai.tool.call.id", "tool.call_id"),
    runtimeToolCallId: pickText(a, "runtime_tool_call_id"),
    toolName: pickText(a, "tool_name", "gen_ai.tool.name", "tool.name"),
    toolInput: json(first(a.tool_input, a.tool_parameters, a.arguments)),
    success: bool(a.success),
    durationMs: number(a.duration_ms),
    cwd: pickText(a, "cwd", "directory"),
    tokens: usage,
    usageScope: usage ? "event" : undefined,
    tokenInputIncludesCache:
      usage?.input !== undefined && tool !== OPENCODE_CONFIG_ID
        ? tool === CODEX_CONFIG_ID
        : undefined,
    tokenOutputIncludesReasoning:
      usage?.output !== undefined && tool === CODEX_CONFIG_ID ? true : undefined,
    reportedCostUsd: number(a.cost_usd),
    reportedCostUsdMicros: number(a.cost_usd_micros),
  };
}
function fromLog(
  tool: TelemetryObservation["tool"],
  resource: Obj,
  raw: unknown
): TelemetryObservation {
  const entry = object(raw);
  const a = { ...resource, ...attributes(entry.attributes) };
  const row = base(tool, "log", a, raw);
  const name = row.eventType;
  return {
    ...row,
    timestamp: first(row.timestamp, nanos(entry.timeUnixNano)),
    observedTimestamp: nanos(entry.observedTimeUnixNano),
    prompt:
      name === "user_prompt" || name === "codex.user_prompt"
        ? pickText(a, "prompt_text", "prompt")
        : undefined,
    response:
      name === "assistant_response" || name === "codex.agent_response"
        ? text(a.response)
        : undefined,
    toolOutput: name === "tool_result" || name === "codex.tool_result" ? json(a.output) : undefined,
  };
}
function fromSpan(
  tool: TelemetryObservation["tool"],
  resource: Obj,
  raw: unknown
): TelemetryObservation[] {
  const span = object(raw);
  const a = { ...resource, ...attributes(span.attributes) };
  const baseRow = base(tool, "span", a, raw);
  const row: TelemetryObservation = {
    ...baseRow,
    eventType: text(span.name),
    timestamp: nanos(span.startTimeUnixNano),
    startedAt: nanos(span.startTimeUnixNano),
    endedAt: nanos(span.endTimeUnixNano),
    traceId: text(span.traceId),
    spanId: text(span.spanId),
    parentSpanId: text(span.parentSpanId),
    prompt: text(a.user_prompt),
    response: text(a["ai.response.text"]),
    usageScope: baseRow.tokens ? "span-snapshot" : undefined,
    tokenInputIncludesCache:
      a["ai.usage.inputTokens"] !== undefined ? true : baseRow.tokenInputIncludesCache,
    tokenOutputIncludesReasoning:
      a["ai.usage.outputTokens"] !== undefined ? true : baseRow.tokenOutputIncludesReasoning,
  };
  return [
    row,
    ...list(span.events).map((rawEvent): TelemetryObservation => {
      const event = object(rawEvent);
      const ea = attributes(event.attributes);
      return {
        tool,
        signal: "span-event",
        source: json(rawEvent),
        eventType: text(event.name),
        timestamp: nanos(event.timeUnixNano),
        toolVersion: row.toolVersion,
        sessionId: row.sessionId,
        traceId: row.traceId,
        spanId: row.spanId,
        toolCallId: row.toolCallId,
        toolName: row.toolName,
        toolOutput: event.name === "tool.output" ? json(ea.output) : undefined,
      };
    }),
  ];
}
function fromMetric(
  tool: TelemetryObservation["tool"],
  resource: Obj,
  raw: unknown
): TelemetryObservation[] {
  const metric = object(raw);
  const name = text(metric.name);
  return ["sum", "gauge", "histogram"].flatMap((kind) =>
    list(object(metric[kind]).dataPoints).map((rawPoint): TelemetryObservation => {
      const point = object(rawPoint);
      const a = { ...resource, ...attributes(point.attributes) };
      const metricType = pickText(a, "type", "token_type");
      const amount = first(number(point.asInt), number(point.asDouble), number(point.sum));
      const tokenKinds: Record<string, keyof NonNullable<TelemetryObservation["tokens"]>> = {
        input: "input",
        output: "output",
        cacheRead: "cacheRead",
        cacheCreation: "cacheWrite",
        cached_input: "cacheRead",
        cache_write_input: "cacheWrite",
        reasoning_output: "reasoning",
      };
      const token = metricType && tokenKinds[metricType];
      const usage =
        (name === "claude_code.token.usage" || name === "codex.turn.token_usage") &&
        token &&
        amount !== undefined
          ? { [token]: amount }
          : undefined;
      return {
        ...base(tool, "metric", a, rawPoint),
        eventType: name,
        timestamp: nanos(point.timeUnixNano),
        startedAt: nanos(point.startTimeUnixNano),
        metricName: name,
        metricType,
        metricValue: amount,
        tokens: usage,
        usageScope: usage ? "metric-aggregate" : undefined,
      };
    })
  );
}
function otel(tool: TelemetryObservation["tool"], capture: OtelCapture): TelemetryObservation[] {
  const payload = object(capture.payload);
  if (capture.signal === "logs")
    return list(payload.resourceLogs).flatMap((r) => {
      const resource = object(r);
      const attrs = attributes(object(resource.resource).attributes);
      return list(resource.scopeLogs).flatMap((s) =>
        list(object(s).logRecords).map((entry) => fromLog(tool, attrs, entry))
      );
    });
  if (capture.signal === "traces")
    return list(payload.resourceSpans).flatMap((r) => {
      const resource = object(r);
      const attrs = attributes(object(resource.resource).attributes);
      return list(resource.scopeSpans).flatMap((s) =>
        list(object(s).spans).flatMap((entry) => fromSpan(tool, attrs, entry))
      );
    });
  return list(payload.resourceMetrics).flatMap((r) => {
    const resource = object(r);
    const attrs = attributes(object(resource.resource).attributes);
    return list(resource.scopeMetrics).flatMap((s) =>
      list(object(s).metrics).flatMap((entry) => fromMetric(tool, attrs, entry))
    );
  });
}
export function transformClaude(source: ClaudeTelemetrySource): TelemetryObservation[] {
  return otel(CLAUDE_CONFIG_ID, source);
}
export function transformCodex(source: CodexTelemetrySource): TelemetryObservation[] {
  return otel(CODEX_CONFIG_ID, source);
}
function openCodeTokens(raw: unknown): TelemetryObservation["tokens"] {
  const t = object(raw);
  const cache = object(t.cache);
  return tokens({
    input: number(t.input),
    output: number(t.output),
    cacheRead: number(cache.read),
    cacheWrite: number(cache.write),
    reasoning: number(t.reasoning),
    total: number(t.total),
  });
}
function openCodeV1(source: OpenCodeV1Source): TelemetryObservation[] {
  const p = object(source.properties);
  const info = object(p.info);
  const part = object(p.part);
  const state = object(part.state);
  const model = object(info.model);
  const step = part.type === "step-finish";
  const usage = openCodeTokens(step ? part.tokens : info.tokens);
  const status = text(state.status);
  return [
    {
      tool: OPENCODE_CONFIG_ID,
      signal: "event",
      source: json(source),
      openCodeVersion: 1,
      eventType: source.type,
      timestamp: first(millis(p.time), millis(object(info.time).created)),
      sessionId: first(
        text(p.sessionID),
        text(info.sessionID),
        text(part.sessionID),
        source.type === "session.created" ? text(info.id) : undefined
      ),
      messageId: first(
        source.type === "message.updated" ? text(info.id) : undefined,
        text(part.messageID)
      ),
      toolVersion: text(info.version),
      partId: text(part.id),
      provider: first(text(info.providerID), text(model.providerID)),
      model: first(text(info.modelID), text(model.modelID)),
      role: text(info.role),
      text: part.type === "text" ? text(part.text) : undefined,
      toolCallId: part.type === "tool" ? text(part.callID) : undefined,
      toolName: part.type === "tool" ? text(part.tool) : undefined,
      toolInput: part.type === "tool" ? json(state.input) : undefined,
      toolOutput: part.type === "tool" ? json(state.output) : undefined,
      success: status === "completed" ? true : status === "error" ? false : undefined,
      error: status === "error" ? json(state.error) : undefined,
      tokens: usage,
      usageScope: usage
        ? step
          ? "step-snapshot"
          : source.type === "session.created" || source.type === "session.updated"
            ? "session-cumulative"
            : "message-snapshot"
        : undefined,
      tokenInputIncludesCache: usage?.input !== undefined ? false : undefined,
      tokenOutputIncludesReasoning: usage?.output !== undefined ? false : undefined,
      zeroMayMeanMissing: usage ? true : undefined,
      reportedCostUsd: number(step ? part.cost : info.cost),
      cwd: text(object(info.path).cwd),
    },
  ];
}
function openCodeV2(source: OpenCodeV2Source): TelemetryObservation[] {
  const d = object(source.data);
  const model = object(d.model);
  const item = object(d.item);
  const itemPayload = object(item.payload);
  const inboxModel = object(object(itemPayload.metadata).model);
  const usage = openCodeTokens(d.tokens);
  const kind = source.type;
  return [
    {
      tool: OPENCODE_CONFIG_ID,
      signal: "event",
      source: json(source),
      openCodeVersion: 2,
      eventType: kind,
      timestamp: millis(source.created),
      toolVersion: kind === "session.created" ? text(d.version) : undefined,
      sessionId: text(d.sessionID),
      messageId: text(d.assistantMessageID),
      provider: first(text(model.providerID), text(inboxModel.providerID)),
      model: first(text(model.id), text(inboxModel.modelID)),
      cwd: text(object(source.location).directory),
      role: kind === "session.inbox.enqueued" ? text(item.type) : undefined,
      prompt:
        kind === "session.inbox.enqueued" && item.type === "user"
          ? text(itemPayload.text)
          : undefined,
      response: kind === "session.text.ended" ? text(d.text) : undefined,
      text: kind === "session.text.delta" ? text(d.delta) : undefined,
      toolCallId: kind.startsWith("session.tool.") ? text(d.id) : undefined,
      toolName: kind === "session.tool.input.started" ? text(d.name) : undefined,
      toolInput:
        kind === "session.tool.called"
          ? json(d.input)
          : kind === "session.tool.input.ended"
            ? json(d.text)
            : undefined,
      toolOutput: kind === "session.tool.success" ? json(d.content) : undefined,
      success:
        kind === "session.tool.success" ? true : kind === "session.tool.failed" ? false : undefined,
      error: kind === "session.tool.failed" ? json(d.error) : undefined,
      tokens: usage,
      usageScope: usage
        ? kind === "session.usage.updated"
          ? "session-cumulative"
          : "event"
        : undefined,
      tokenInputIncludesCache: usage?.input !== undefined ? false : undefined,
      tokenOutputIncludesReasoning: usage?.output !== undefined ? false : undefined,
      zeroMayMeanMissing: usage ? true : undefined,
      reportedCostUsd: number(d.cost),
    },
  ];
}
export function transformOpenCode(source: OpenCodeTelemetrySource): TelemetryObservation[] {
  if ("signal" in source) return otel(OPENCODE_CONFIG_ID, source);
  if ("properties" in source) return openCodeV1(source);
  return openCodeV2(source);
}

/** Decode one captured JSON line. Unknown or malformed records remain visibly unrecognised. */
export function transformCapturedLine(tool: Config, line: string): TelemetryObservation[] {
  let input: Obj;
  try {
    input = object(JSON.parse(line));
  } catch {
    return [];
  }
  if (input.signal === "logs" || input.signal === "traces" || input.signal === "metrics") {
    const source: OtelCapture = { signal: input.signal, payload: input.payload };
    if (tool === CLAUDE_CONFIG_ID) return transformClaude(source);
    if (tool === CODEX_CONFIG_ID) return transformCodex(source);
    return transformOpenCode(source);
  }
  if (tool !== OPENCODE_CONFIG_ID || typeof input.type !== "string") return [];
  if ("properties" in input)
    return transformOpenCode({ type: input.type, properties: input.properties });
  if ("data" in input)
    return transformOpenCode({
      type: input.type,
      data: input.data,
      created: number(input.created),
      location: input.location,
    });
  return [];
}
