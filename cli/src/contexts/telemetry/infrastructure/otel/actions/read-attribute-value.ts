import { asPlainObject } from "../../../../../kernel/reading/plain-object.js";

const invalid = () => new Error("Invalid OTLP attribute value.");
const specialDoubles = new Set(["NaN", "Infinity", "-Infinity"]);

/** Keep AnyValue's oneof type until it has been validated; never coerce containers. */
export function readAttributeValue(raw: unknown, scalarRequired: boolean): string | undefined {
  if (!scalarRequired && (raw === undefined || raw === null)) return undefined;
  const value = asPlainObject(raw);
  if (!value) throw invalid();
  const fields = Object.entries(value);
  if (fields.length === 0 && !scalarRequired) return undefined;
  const first = fields.at(0);
  if (fields.length !== 1 || !first) throw invalid();
  const [kind, item] = first;
  if (kind === "stringValue") {
    if (typeof item !== "string") throw invalid();
    return item;
  }
  if (kind === "boolValue") {
    if (typeof item !== "boolean") throw invalid();
    return String(item);
  }
  if (kind === "intValue") return readInteger(item);
  if (kind === "doubleValue") {
    if (typeof item === "number" && Number.isFinite(item)) return String(item);
    if (!scalarRequired && typeof item === "string" && specialDoubles.has(item)) return item;
    throw invalid();
  }
  if (scalarRequired) throw invalid();
  if (kind === "bytesValue") {
    if (typeof item !== "string") throw invalid();
    return undefined;
  }
  if (kind === "arrayValue" || kind === "kvlistValue") {
    const container = asPlainObject(item);
    if (!container || (container.values !== undefined && !Array.isArray(container.values)))
      throw invalid();
    for (const child of container.values ?? []) {
      const nested = kind === "arrayValue" ? child : asPlainObject(child)?.value;
      readAttributeValue(nested, false);
    }
    return undefined;
  }
  // Profiling dictionary references and unknown optional extensions are not log values.
  return undefined;
}

function readInteger(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw invalid();
  } else if (typeof value !== "string" || !/^-?\d{1,20}$/.test(value)) {
    throw invalid();
  }
  const integer = BigInt(value);
  if (integer < -9223372036854775808n || integer > 9223372036854775807n) throw invalid();
  return String(value);
}
