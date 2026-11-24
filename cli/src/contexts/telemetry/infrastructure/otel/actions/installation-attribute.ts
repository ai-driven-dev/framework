import { asPlainObject } from "../../../../../kernel/reading/plain-object.js";

const KEY = "aidd.installation.id";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A provider must not override the installation declared by the AIDD runner. */
export function checkInstallationClaim(value: unknown, id: string): void {
  if (!UUID_V4.test(id)) throw new Error("Installation ID is invalid.");
  if (Array.isArray(value)) {
    for (const item of value) checkInstallationClaim(item, id);
    return;
  }
  const object = asPlainObject(value);
  if (!object) return;
  if (object.key === KEY && asPlainObject(object.value)?.stringValue !== id)
    throw new Error("Conflicting OTLP installation ID.");
  for (const item of Object.values(object)) checkInstallationClaim(item, id);
}

/** Label an already selected transfer; it is an installation claim, not a user identity. */
export function attachInstallationId(
  payload: unknown,
  field: "resourceLogs" | "resourceMetrics" | "resourceSpans",
  id: string
): Record<string, unknown> {
  checkInstallationClaim(payload, id);
  const source = asPlainObject(payload);
  const resources = source?.[field];
  if (!source || !Array.isArray(resources)) throw new Error("Invalid OTLP resource envelope.");
  return {
    ...source,
    [field]: resources.map((value) => {
      const entry = asPlainObject(value);
      if (!entry) throw new Error("Invalid OTLP resource.");
      const resource = asPlainObject(entry.resource) ?? {};
      const attrs = resource.attributes;
      if (attrs !== undefined && !Array.isArray(attrs)) throw new Error("Invalid OTLP attributes.");
      return {
        ...entry,
        resource: {
          ...resource,
          attributes: [
            ...(attrs ?? []).filter((item) => asPlainObject(item)?.key !== KEY),
            { key: KEY, value: { stringValue: id } },
          ],
        },
      };
    }),
  };
}
