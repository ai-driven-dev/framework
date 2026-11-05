import { stripJsonComments } from "../../../../kernel/reading/jsonc.js";
import { AGENT_MODELS, type AgentHost, type AgentProvider, tierModel } from "./agent-models.js";

/** Main-session settings AIDD writes, keyed by the host's native config key. */
export type MainModelValues = Record<string, string>;

/** What AIDD wrote, where, and what each key held before, so removal restores it. */
export interface MainModelRecord {
  /** The settings file written, so removal restores that file whatever the environment says. */
  path: string;
  written: MainModelValues;
  previous: Record<string, string | null>;
  /** The settings file did not exist before AIDD wrote it. */
  created: boolean;
}

/** The provider's model for the main session's tier, under the host's own keys; effort only
 * where the host has a settings key for it. Empty for a host with no file-based main model. */
export function mainModelValues(host: AgentHost, provider: AgentProvider): MainModelValues {
  const settings = AGENT_MODELS.hosts[host].main;
  if (settings === undefined) return {};
  const { model, effort } = tierModel(host, provider, AGENT_MODELS.main);
  return settings.effortKey === undefined ? { model } : { model, [settings.effortKey]: effort };
}

/**
 * Sets the main model in `path`, recording what each key held before. A key the person changed
 * since AIDD wrote it is theirs again, so its current value becomes the one to restore. Refuses
 * a file holding comments, which rewriting would drop, and a key holding no string.
 */
export function planMainModelInstall(
  path: string,
  content: string | null,
  values: MainModelValues,
  record: MainModelRecord | undefined
): { content: string; record: MainModelRecord } {
  const settings = readSettings(content);
  const previous: Record<string, string | null> = {};
  for (const key of Object.keys(values)) {
    const value = settings[key];
    if (value !== undefined && typeof value !== "string")
      throw new Error(`"${key}" is not a string`);
    const ours = record !== undefined && Object.hasOwn(record.written, key);
    previous[key] =
      ours && value === record.written[key] ? (record.previous[key] ?? null) : (value ?? null);
  }
  return {
    content: serialize({ ...settings, ...values }),
    record: {
      path,
      written: values,
      previous,
      created: content === null || (record?.created ?? false),
    },
  };
}

/** Restores the keys AIDD's values still hold; leaves a key the person changed as it is.
 * `null` content means the file is to be deleted. Throws on a file it cannot read, so the
 * record survives for a later run. */
export function planMainModelRemoval(
  content: string | null,
  record: MainModelRecord
): string | null {
  if (content === null) return null;
  const settings = readSettings(content);
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
  if (stripJsonComments(content) !== content)
    throw new Error("it holds comments or trailing commas, which rewriting it would drop");
  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("it holds no JSON object");
  return parsed as Record<string, unknown>;
}

function serialize(settings: Record<string, unknown>): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}
