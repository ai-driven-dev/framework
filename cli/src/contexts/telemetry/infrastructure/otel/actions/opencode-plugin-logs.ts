import { asPlainObject } from "../../../../../kernel/reading/plain-object.js";
import { OPENCODE_CONFIG_ID } from "../settings.js";

type Fields = Map<string, string | number>;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const object = (value: unknown) => asPlainObject(value) ?? {};
const string = (key: string, value: string) => ({ key, value: { stringValue: value } });
const integer = (key: string, value: number) => ({ key, value: { intValue: String(value) } });
const label = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/@+#-]{0,199}$/u.test(value);
const id = (value: unknown, prefix: string): value is string =>
  typeof value === "string" && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);

function attributes(value: unknown): Fields {
  const result: Fields = new Map();
  const seen = new Set<string>();
  for (const item of list(value)) {
    const entry = object(item);
    const data = object(entry.value);
    if (typeof entry.key !== "string" || seen.has(entry.key)) return new Map();
    seen.add(entry.key);
    const raw = data.stringValue ?? data.intValue;
    if (typeof raw === "string" || typeof raw === "number") result.set(entry.key, raw);
  }
  return result;
}

function numeric(value: unknown, minimum: number): number | undefined {
  if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value))) return;
  const result = Number(value);
  if (Number.isSafeInteger(result) && result >= minimum) return result;
  return undefined;
}

/** Select only the plugin's documented technical fields; never forward raw provider logs. */
export type OpenCodePluginLog = { session: string; parent?: string; payload: unknown };

export function openCodePluginLogs(line: string): OpenCodePluginLog[] {
  const envelope = object(JSON.parse(line));
  if (envelope.signal !== "logs") return [];
  const selected: OpenCodePluginLog[] = [];
  for (const rawResource of list(object(envelope.payload).resourceLogs)) {
    const resource = object(rawResource);
    const resourceAttributes = attributes(object(resource.resource).attributes);
    if (resourceAttributes.get("service.name") !== OPENCODE_CONFIG_ID) continue;
    const version = resourceAttributes.get("service.version");
    for (const rawScope of list(resource.scopeLogs)) {
      const scope = object(rawScope);
      if (object(scope.scope).name !== "aidd.opencode.otel" || object(scope.scope).version !== "1")
        continue;
      for (const rawRecord of list(scope.logRecords)) {
        const record = object(rawRecord);
        const values = attributes(record.attributes);
        const name = values.get("event.name");
        const eventId = values.get("event.id");
        const session = values.get("session.id");
        const message = values.get("assistant.message.id");
        const seq = numeric(values.get("opencode.event.sequence"), 0);
        const eventVersion = numeric(values.get("opencode.event.version"), 1);
        const time = record.timeUnixNano;
        if (
          typeof name !== "string" ||
          ![
            "session.created",
            "session.step.started",
            "session.step.ended",
            "session.step.failed",
          ].includes(name) ||
          !id(eventId, "evt") ||
          !id(session, "ses") ||
          (name !== "session.created" && !id(message, "msg")) ||
          seq === undefined ||
          eventVersion !== 1 ||
          typeof time !== "string" ||
          !/^[1-9]\d{0,19}$/.test(time) ||
          BigInt(time) > 18446744073709551615n
        )
          continue;
        const safe = [
          string("event.name", name),
          string("event.id", eventId),
          string("session.id", session),
          integer("opencode.event.sequence", seq),
          integer("opencode.event.version", eventVersion),
        ];
        if (typeof message === "string" && name !== "session.created")
          safe.push(string("assistant.message.id", message));
        const strings =
          name === "session.created"
            ? ["opencode.project.id", "opencode.parent.session.id"]
            : name === "session.step.started"
              ? [
                  "opencode.model.provider",
                  "opencode.model.name",
                  "opencode.model.variant",
                  "opencode.agent.name",
                ]
              : [];
        for (const key of strings) {
          const value = values.get(key);
          if (label(value) && (key !== "opencode.parent.session.id" || id(value, "ses")))
            safe.push(string(key, value));
        }
        if (name === "session.step.ended" || name === "session.step.failed") {
          for (const key of [
            "opencode.usage.input",
            "opencode.usage.output",
            "opencode.usage.reasoning",
            "opencode.usage.cache_read",
            "opencode.usage.cache_write",
          ]) {
            const value = numeric(values.get(key), 1);
            if (value !== undefined) safe.push(integer(key, value));
          }
        }
        const resourceAttrs = [string("service.name", OPENCODE_CONFIG_ID)];
        if (label(version)) resourceAttrs.push(string("service.version", version));
        const parent = values.get("opencode.parent.session.id");
        selected.push({
          session,
          ...(name === "session.created" && id(parent, "ses") ? { parent } : {}),
          payload: {
            resourceLogs: [
              {
                resource: { attributes: resourceAttrs },
                scopeLogs: [
                  {
                    scope: { name: "aidd.opencode.otel", version: "1" },
                    logRecords: [{ timeUnixNano: time, attributes: safe }],
                  },
                ],
              },
            ],
          },
        });
      }
    }
  }
  return selected;
}

/** Keep only descendants whose parent is explicitly present in a session.created observation. */
export function relatedOpenCodeLogs(root: string, logs: OpenCodePluginLog[]): OpenCodePluginLog[] {
  const parents = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!log.parent) continue;
    const candidates = parents.get(log.session) ?? new Set<string>();
    candidates.add(log.parent);
    parents.set(log.session, candidates);
  }
  const known = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [session, candidates] of parents) {
      if (known.has(session) || candidates.size !== 1 || !known.has([...candidates][0])) continue;
      known.add(session);
      changed = true;
    }
  }
  return logs.filter((log) => known.has(log.session));
}
