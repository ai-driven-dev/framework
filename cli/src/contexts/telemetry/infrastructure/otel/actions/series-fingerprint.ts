import { createHash } from "node:crypto";

export function seriesFingerprint(resource: unknown, scope: unknown, point: unknown): string {
  const resourceEnvelope = record(resource);
  const resourceInfo = record(resourceEnvelope.resource);
  const scopeEnvelope = record(scope);
  const scopeInfo = record(scopeEnvelope.scope);
  const value = {
    resource: {
      schemaUrl: resourceEnvelope.schemaUrl ?? null,
      attributes: canonicalAttributes(resourceInfo.attributes),
      droppedAttributesCount: resourceInfo.droppedAttributesCount ?? null,
    },
    scope: {
      schemaUrl: scopeEnvelope.schemaUrl ?? null,
      name: scopeInfo.name ?? null,
      version: scopeInfo.version ?? null,
      attributes: canonicalAttributes(scopeInfo.attributes),
      droppedAttributesCount: scopeInfo.droppedAttributesCount ?? null,
    },
    metric: canonical(scopeEnvelope.metric),
    point: canonicalAttributes(point),
  };
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function canonicalAttributes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => JSON.stringify(canonical(item))).sort();
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value ?? null;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => [key, key === "intValue" ? canonicalInteger(item) : canonical(item)])
  );
}

function canonicalInteger(value: unknown): string {
  if (typeof value === "number" && !Number.isSafeInteger(value))
    throw new Error("OTLP integer attribute is not exactly representable.");
  const input = String(value);
  if (!/^-?\d{1,20}$/.test(input)) throw new Error("Invalid OTLP integer attribute.");
  return BigInt(input).toString();
}
