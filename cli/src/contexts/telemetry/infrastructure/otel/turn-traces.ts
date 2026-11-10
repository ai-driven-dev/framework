import { asPlainObject } from "../../../../kernel/reading/plain-object.js";
import type { Transfer } from "./actions/sync.js";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const TEXT_KEYS = new Set(["thread.id", "turn.id", "model", "codex.turn.reasoning_effort"]);
const COUNTER_KEYS = new Set([
  "codex.turn.token_usage.input_tokens",
  "codex.turn.token_usage.cached_input_tokens",
  "codex.turn.token_usage.cache_write_input_tokens",
  "codex.turn.token_usage.non_cached_input_tokens",
  "codex.turn.token_usage.output_tokens",
  "codex.turn.token_usage.reasoning_output_tokens",
  "codex.turn.token_usage.total_tokens",
]);
const obj = (value: unknown) => asPlainObject(value) ?? {};
const list = (value: unknown) => (Array.isArray(value) ? value : []);

function safeAttributes(
  value: unknown
): Map<string, { stringValue: string } | { intValue: string | number }> {
  const result = new Map<string, { stringValue: string } | { intValue: string | number }>();
  for (const raw of list(value)) {
    const entry = obj(raw);
    const key = entry.key;
    if (typeof key !== "string" || (!TEXT_KEYS.has(key) && !COUNTER_KEYS.has(key))) continue;
    const content = obj(entry.value);
    // tracing adds a runtime integer thread.id alongside Codex's string UUID thread.id.
    if (key === "thread.id" && content.intValue !== undefined && content.stringValue === undefined)
      continue;
    let safe: { stringValue: string } | { intValue: string | number };
    if (TEXT_KEYS.has(key)) {
      if (typeof content.stringValue !== "string" || Object.keys(content).length !== 1)
        throw new Error("Invalid Codex turn attribute.");
      const text = content.stringValue;
      if (
        key === "thread.id" || key === "turn.id"
          ? !UUID.test(text)
          : !/^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,127}$/.test(text)
      )
        throw new Error("Invalid Codex turn attribute.");
      safe = { stringValue: text };
    } else {
      const number = content.intValue;
      if (
        Object.keys(content).length !== 1 ||
        !(
          (typeof number === "string" &&
            /^\d+$/.test(number) &&
            Number.isSafeInteger(Number(number))) ||
          (typeof number === "number" && Number.isSafeInteger(number) && number >= 0)
        )
      )
        throw new Error("Invalid Codex turn counter.");
      safe = { intValue: number as string | number };
    }
    const previous = result.get(key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(safe))
      throw new Error("Conflicting Codex turn attribute.");
    result.set(key, safe);
  }
  return result;
}

function time(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{1,20}$/.test(value)) return undefined;
  const nanos = BigInt(value);
  if (nanos <= 0n || nanos > 18446744073709551615n) return undefined;
  try {
    return new Date(Number(nanos / 1_000_000n)).toISOString();
  } catch {
    return undefined;
  }
}

/** Only provider turn spans are exported: no events, links, paths or prompt content. */
export function codexTurnTransfers(payload: unknown, session: string): Transfer[] {
  const transfers: Transfer[] = [];
  for (const rawResource of list(obj(payload).resourceSpans)) {
    for (const rawScope of list(obj(rawResource).scopeSpans)) {
      for (const rawSpan of list(obj(rawScope).spans)) {
        const span = obj(rawSpan);
        if (span.name !== "session_task.turn") continue;
        const identity = safeAttributes(
          list(span.attributes).filter((item) => obj(item).key === "thread.id")
        );
        const thread = obj(identity.get("thread.id")).stringValue;
        if (typeof thread !== "string") throw new Error("Codex turn session ID is missing.");
        if (thread.toLowerCase() !== session.toLowerCase()) continue;
        const attrs = safeAttributes(span.attributes);
        if (!attrs.has("turn.id")) throw new Error("Codex turn ID is missing.");
        if (
          typeof span.traceId !== "string" ||
          !/^[a-f0-9]{32}$/i.test(span.traceId) ||
          /^0+$/.test(span.traceId) ||
          typeof span.spanId !== "string" ||
          !/^[a-f0-9]{16}$/i.test(span.spanId) ||
          /^0+$/.test(span.spanId)
        )
          throw new Error("Invalid Codex trace identifier.");
        const start = time(span.startTimeUnixNano);
        const at = time(span.endTimeUnixNano);
        if (
          !start ||
          !at ||
          BigInt(String(span.startTimeUnixNano)) > BigInt(String(span.endTimeUnixNano))
        )
          throw new Error("Invalid Codex turn interval.");
        const safe = [...attrs].map(([key, value]) => ({ key, value }));
        transfers.push({
          signal: "traces",
          start,
          at,
          payload: {
            resourceSpans: [
              {
                scopeSpans: [
                  {
                    spans: [
                      {
                        name: "session_task.turn",
                        traceId: span.traceId,
                        spanId: span.spanId,
                        startTimeUnixNano: span.startTimeUnixNano,
                        endTimeUnixNano: span.endTimeUnixNano,
                        attributes: safe,
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
  return transfers;
}
