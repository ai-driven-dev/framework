import type { AiToolId } from "../../../../kernel/tool.js";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** A source observation. Missing values stay missing; identical observations are not merged. */
export interface TelemetryObservation {
  readonly tool: AiToolId;
  readonly signal: "log" | "span" | "span-event" | "metric" | "event";
  readonly eventType?: string;
  readonly timestamp?: string;
  readonly observedTimestamp?: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly toolVersion?: string;
  readonly openCodeVersion?: 1 | 2;
  readonly sessionId?: string;
  readonly threadId?: string;
  readonly messageId?: string;
  readonly partId?: string;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly parentSpanId?: string;
  readonly requestId?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly role?: string;
  readonly prompt?: string;
  readonly response?: string;
  /** Text whose user/assistant role cannot be established from this event alone. */
  readonly text?: string;
  readonly toolCallId?: string;
  readonly runtimeToolCallId?: string;
  readonly toolName?: string;
  readonly toolInput?: JsonValue;
  readonly toolOutput?: JsonValue;
  readonly success?: boolean;
  readonly error?: JsonValue;
  readonly durationMs?: number;
  readonly cwd?: string;
  readonly gitBranch?: string;
  readonly tokens?: {
    readonly input?: number;
    readonly inputNonCached?: number;
    readonly output?: number;
    readonly cacheRead?: number;
    readonly cacheWrite?: number;
    readonly cacheWrite5m?: number;
    readonly cacheWrite1h?: number;
    readonly reasoning?: number;
    readonly total?: number;
    readonly tool?: number;
  };
  /** Snapshots and aggregates must not be summed as model calls. */
  readonly usageScope?:
    | "event"
    | "span-snapshot"
    | "step-snapshot"
    | "message-snapshot"
    | "session-cumulative"
    | "metric-aggregate";
  readonly tokenInputIncludesCache?: boolean;
  readonly tokenOutputIncludesReasoning?: boolean;
  /** OpenCode substitutes zero when an upstream token count was not supplied. */
  readonly zeroMayMeanMissing?: boolean;
  /** As reported by the source, not a calculated or validated price. */
  readonly reportedCostUsd?: number;
  readonly reportedCostUsdMicros?: number;
  readonly metricName?: string;
  readonly metricType?: string;
  readonly metricValue?: number;
  /** The original observation, retained for fields not yet selected for a display. */
  readonly source?: JsonValue;
}
