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
  readonly signal: "log" | "span" | "span-event" | "metric";
  readonly eventType?: string;
  readonly timestamp?: string;
  readonly observedTimestamp?: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly toolVersion?: string;
  readonly sessionId?: string;
  readonly threadId?: string;
  readonly turnId?: string;
  readonly promptId?: string;
  readonly clientRequestId?: string;
  readonly messageId?: string;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly parentSpanId?: string;
  readonly requestId?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly prompt?: string;
  readonly response?: string;
  readonly toolCallId?: string;
  readonly runtimeToolCallId?: string;
  readonly toolName?: string;
  readonly toolInput?: JsonValue;
  readonly toolOutput?: JsonValue;
  readonly success?: boolean;
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
  readonly usageScope?: "event" | "span-snapshot" | "metric-aggregate";
  readonly tokenInputIncludesCache?: boolean;
  readonly tokenOutputIncludesReasoning?: boolean;
  /** Codex may report zero for cache counts missing from provider usage. */
  readonly cacheZeroMayMeanMissing?: boolean;
  /** As reported by the source, not a calculated or validated price. */
  readonly reportedCostUsd?: number;
  readonly reportedCostUsdMicros?: number;
  readonly metricName?: string;
  readonly metricType?: string;
  readonly metricValue?: number;
  /** The original observation, retained for fields not yet selected for a display. */
  readonly source?: JsonValue;
}
