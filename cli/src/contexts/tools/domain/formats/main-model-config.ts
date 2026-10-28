import { parse } from "smol-toml";
import { AGENT_MODELS, type AgentHost, type AgentProvider, tierModel } from "./agent-models.js";

/** Main-session settings AIDD writes, keyed by the host's native config key. */
export type MainModelValues = Record<string, string>;

export type SettingsFormat = "json" | "toml";

/** What AIDD wrote and what each key held before, so removal restores it. */
export interface MainModelRecord {
  written: MainModelValues;
  previous: Record<string, string | null>;
  /** The settings file did not exist before AIDD wrote it. */
  created: boolean;
}

export function settingsFormat(path: string): SettingsFormat {
  return path.endsWith(".toml") ? "toml" : "json";
}

/** The provider's `smart` model under the host's own keys; effort only where the host has a
 * settings key for it. Empty for a host with no file-based main model. */
export function mainModelValues(host: AgentHost, provider: AgentProvider): MainModelValues {
  const settings = AGENT_MODELS.hosts[host].main;
  if (settings === undefined) return {};
  const { model, effort } = tierModel(host, provider, AGENT_MODELS.main);
  return settings.effortKey === undefined ? { model } : { model, [settings.effortKey]: effort };
}

/** Sets the main model, recording prior values; refuses values changed since AIDD wrote them. */
export function planMainModelInstall(
  content: string | null,
  format: SettingsFormat,
  values: MainModelValues,
  record: MainModelRecord | undefined
): { content: string; record: MainModelRecord } {
  const current = readSettings(content, format);
  for (const [key, value] of Object.entries(record?.written ?? {}))
    if (current[key] !== value)
      throw new Error(`"${key}" changed since AIDD set it; restore it or edit it yourself.`);
  const previous: Record<string, string | null> = {};
  for (const key of Object.keys(values)) {
    const value = current[key];
    if (value !== undefined && typeof value !== "string")
      throw new Error(`"${key}" is not a string; edit it yourself.`);
    previous[key] = value ?? null;
  }
  return {
    content: editSettings(content, format, values, []),
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
  format: SettingsFormat,
  record: MainModelRecord
): string | null {
  if (content === null) return null;
  try {
    const current = readSettings(content, format);
    const set: MainModelValues = {};
    const unset: string[] = [];
    for (const [key, value] of Object.entries(record.written)) {
      if (current[key] !== value) continue;
      const previous = record.previous[key] ?? null;
      if (previous === null) unset.push(key);
      else set[key] = previous;
    }
    if (Object.keys(set).length === 0 && unset.length === 0) return content;
    const next = editSettings(content, format, set, unset);
    return record.created && Object.keys(readSettings(next, format)).length === 0 ? null : next;
  } catch {
    return content;
  }
}

function readSettings(content: string | null, format: SettingsFormat): Record<string, unknown> {
  if (content === null || content.trim() === "") return {};
  if (format === "toml") return parse(content);
  const parsed: unknown = JSON.parse(content.replace(/^﻿/, ""));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error("Settings file must contain a JSON object.");
  return parsed as Record<string, unknown>;
}

function editSettings(
  content: string | null,
  format: SettingsFormat,
  set: MainModelValues,
  unset: readonly string[]
): string {
  const settings = readSettings(content, format);
  for (const [key, value] of Object.entries(set)) settings[key] = value;
  for (const key of unset) delete settings[key];
  if (format === "json") {
    const bom = content?.startsWith("﻿") ? "﻿" : "";
    const indent = /\n([ \t]+)"/.exec(content ?? "")?.[1] ?? "  ";
    return `${bom}${JSON.stringify(settings, null, indent)}\n`;
  }
  const next = editTomlLines(content ?? "", set, unset);
  const unsafe = new Error("Cannot edit this TOML safely; set the model yourself.");
  let edited: unknown;
  try {
    edited = parse(next);
  } catch {
    throw unsafe;
  }
  if (canonical(edited) !== canonical(settings)) throw unsafe;
  return next;
}

/** Rewrites only simple top-level `key = "value"` lines, keeping comments and line endings. */
function editTomlLines(content: string, set: MainModelValues, unset: readonly string[]): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content === "" ? [""] : content.split(/\r?\n/);
  const inserted: string[] = [];
  for (const [key, value] of Object.entries(set)) {
    const index = topLevelKeyIndex(lines, key);
    const line = `${key} = ${JSON.stringify(value)}`;
    if (index === -1) inserted.push(line);
    else lines[index] = (lines[index] as string).replace(valuePattern(key), `${line}$1`);
  }
  for (const key of unset) {
    const index = topLevelKeyIndex(lines, key);
    if (index !== -1) lines.splice(index, 1);
  }
  return [...inserted, ...lines].join(eol);
}

function valuePattern(key: string): RegExp {
  return new RegExp(`^\\s*${key}\\s*=\\s*(?:"(?:[^"\\\\]|\\\\.)*"|'[^']*')(\\s*(?:#.*)?)$`);
}

/** Index of `key = ...` before the first table header, or -1. */
function topLevelKeyIndex(lines: readonly string[], key: string): number {
  const assignment = new RegExp(`^\\s*${key}\\s*=`);
  for (const [index, line] of lines.entries()) {
    if (/^\s*\[/.test(line)) return -1;
    if (assignment.test(line)) return index;
  }
  return -1;
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_, entry) =>
    entry !== null && typeof entry === "object" && !Array.isArray(entry) && !(entry instanceof Date)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
      : entry
  );
}
