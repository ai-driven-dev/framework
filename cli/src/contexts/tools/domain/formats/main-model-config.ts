import { AGENT_MODELS, type AgentHost, type AgentProvider, tierModel } from "./agent-models.js";

/** Main-session settings AIDD writes, keyed by the host's native config key. */
export type MainModelValues = Record<string, string>;

/** What AIDD wrote and what each key held before, so removal restores it. */
export interface MainModelRecord {
  written: MainModelValues;
  previous: Record<string, string | null>;
  /** The settings file did not exist before AIDD wrote it. */
  created: boolean;
}

/** The provider's `smart` model under the host's own keys; effort only where the host has a
 * settings key for it. Empty for a host with no file-based main model. */
export function mainModelValues(host: AgentHost, provider: AgentProvider): MainModelValues {
  const settings = AGENT_MODELS.hosts[host].main;
  if (settings === undefined) return {};
  const { model, effort } = tierModel(host, provider, AGENT_MODELS.main);
  return settings.effortKey === undefined ? { model } : { model, [settings.effortKey]: effort };
}

/** Sets the main model, recording what each key held before AIDD first wrote it. */
export function planMainModelInstall(
  content: string | null,
  values: MainModelValues,
  record: MainModelRecord | undefined
): { content: string; record: MainModelRecord } {
  const settings = readSettings(content);
  const previous: Record<string, string | null> = {};
  for (const key of Object.keys(values)) {
    const value = settings[key];
    if (value !== undefined && typeof value !== "string")
      throw new Error(`"${key}" is not a string; edit it yourself.`);
    previous[key] = value ?? null;
  }
  return {
    content: serialize({ ...settings, ...values }),
    record: {
      written: values,
      previous: { ...previous, ...record?.previous },
      created: record?.created ?? content === null,
    },
  };
}

/** Restores unchanged keys; leaves unreadable or user-edited settings as they are. */
export function planMainModelRemoval(
  content: string | null,
  record: MainModelRecord
): string | null {
  if (content === null) return null;
  let settings: Record<string, unknown>;
  try {
    settings = readSettings(content);
  } catch {
    return content;
  }
  let changed = false;
  for (const [key, value] of Object.entries(record.written)) {
    if (settings[key] !== value) continue;
    const previous = record.previous[key] ?? null;
    if (previous === null) delete settings[key];
    else settings[key] = previous;
    changed = true;
  }
  if (!changed) return content;
  return record.created && Object.keys(settings).length === 0 ? null : serialize(settings);
}

function readSettings(content: string | null): Record<string, unknown> {
  if (content === null || content.trim() === "") return {};
  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("Settings file must contain a JSON object.");
  return parsed as Record<string, unknown>;
}

function serialize(settings: Record<string, unknown>): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}
