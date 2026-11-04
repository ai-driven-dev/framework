import { isDeepStrictEqual } from "node:util";
import { parse, stringify } from "smol-toml";
import { asPlainObject } from "../../../../kernel/reading/plain-object.js";

type Settings = Record<string, unknown>;

function tomlTable(values: Settings = {}): Settings {
  return Object.setPrototypeOf(values, null);
}

function requireObject(value: unknown): Settings {
  const object = asPlainObject(value);
  if (!object) throw new Error("Expected a configuration object.");
  return object;
}

export function rejectConflict(name: string, actual: unknown, expected: string): void {
  if (actual !== undefined && actual !== expected) {
    throw new Error(`Conflicting OTLP setting: ${name}. Resolve it before initializing.`);
  }
}

/** Keep offsets stable while hiding JSONC comments and trailing commas from JSON.parse. */
function normalizeJsonc(content: string): string {
  return content
    .replace(/"(?:[^"\\]|\\.)*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g, (token) =>
      token.startsWith("/") ? token.replace(/[^\r\n]/g, " ") : token
    )
    .replace(/"(?:[^"\\]|\\.)*"|,(?=\s*[}\]])/g, (token) => (token === "," ? " " : token));
}

function readJsonSettings(content: string): Settings {
  try {
    return requireObject(JSON.parse(content));
  } catch {
    throw new Error("Invalid JSON settings.");
  }
}

/** Locate a top-level section and refuse duplicate properties where we are about to edit. */
function sectionOffset(content: string, section: string): number {
  let depth = 0;
  let offset: number | undefined;
  let inSection = false;
  const keys = new Set<string>();
  for (const match of content.matchAll(/"(?:[^"\\]|\\.)*"|[{}[\]]/gs)) {
    const token = match[0];
    if (token === "{" || token === "[") {
      depth++;
    } else if (token === "}" || token === "]") {
      depth--;
      if (depth === 1) inSection = false;
    } else {
      const tail = /^\s*:\s*/.exec(content.slice(match.index + token.length));
      if (!tail) continue;
      const key: string = JSON.parse(token);
      if (depth === 1 && key === section) {
        if (offset !== undefined) throw new Error(`Duplicate ${section} in JSON settings.`);
        offset = match.index + token.length + tail[0].length;
        inSection = true;
      } else if (depth === 2 && inSection) {
        if (keys.has(key)) throw new Error(`Duplicate entry in ${section} settings.`);
        keys.add(key);
      }
    }
  }
  return offset ?? content.indexOf("{");
}

function mergeJsonSection(
  content: string,
  section: string,
  entries: (existing: Settings) => Settings,
  normalize: (source: string) => string = (source) => source
): string {
  const normalized = normalize(content);
  const settings = readJsonSettings(normalized);
  const original = settings[section] === undefined ? settings : requireObject(settings[section]);
  const existing = settings[section] === undefined ? {} : original;
  const offset = sectionOffset(normalized, section) + 1;
  const missing = entries(existing);
  if (Object.keys(missing).length === 0) return content;
  const patch = settings[section] === undefined ? { [section]: missing } : missing;
  const indent = settings[section] === undefined ? "" : "  ";
  const entry = JSON.stringify(patch, null, 2).slice(1, -2).replaceAll("\n", `\n${indent}`);
  const separator = Object.keys(original).length === 0 ? "\n" : ",";
  const next = content.slice(0, offset) + entry + separator + content.slice(offset);
  readJsonSettings(normalize(next));
  return next;
}

export function mergeJsonEnvironment(
  content: string,
  additions: Readonly<Record<string, string>>,
  verify: (env: Settings) => void,
  defaults: Readonly<Record<string, string>> = {}
): string {
  return mergeJsonSection(content, "env", (env) => {
    verify(env);
    for (const [key, value] of Object.entries(additions)) rejectConflict(key, env[key], value);
    return Object.fromEntries(
      Object.entries({ ...defaults, ...additions }).filter(([key]) => env[key] === undefined)
    );
  });
}

export function openCodeInstrumentation(content: string): unknown {
  const settings = readJsonSettings(normalizeJsonc(content));
  return settings.experimental === undefined
    ? undefined
    : requireObject(settings.experimental).openTelemetry;
}

export function mergeOpenCodeInstrumentation(content: string, enabled: boolean): string {
  return mergeJsonSection(
    content,
    "experimental",
    (experimental) => {
      if (experimental.openTelemetry === enabled) return {};
      if (experimental.openTelemetry !== undefined) {
        throw new Error("OpenCode experimental.openTelemetry is disabled or invalid.");
      }
      return { openTelemetry: enabled };
    },
    normalizeJsonc
  );
}

function readToml(content: string): Settings {
  try {
    return parse(content);
  } catch {
    throw new Error("Invalid TOML settings.");
  }
}

function matchesToml(candidate: string, expected: Settings): boolean {
  try {
    return isDeepStrictEqual(parse(candidate), expected);
  } catch {
    // An insertion candidate can redefine a table. Try the next candidate.
    return false;
  }
}

function addTomlTable(content: string, table: string, body: string, expected: Settings): string {
  const header = `[${table}]`;
  const candidates = [`${content ? `${content}\n` : ""}${header}\n${body}`];
  for (const match of content.matchAll(/^\s*\[([^\]\n]+)\][ \t]*(?:#[^\n]*)?(?:\r?\n|$)/gm)) {
    const path = match[1].split(".").map((part) => part.trim().replace(/^["']|["']$/g, ""));
    if (path.join(".") !== table) continue;
    const offset = match.index + match[0].length;
    const newline = match[0].endsWith("\n") ? "" : "\n";
    candidates.push(content.slice(0, offset) + newline + body + content.slice(offset));
  }
  for (const candidate of candidates) {
    if (matchesToml(candidate, expected)) return candidate;
  }
  throw new Error(`Cannot merge ${table} while preserving TOML settings. Use explicit tables.`);
}

export function mergeCodexExporters(
  content: string,
  exporters: Readonly<Record<string, string>>,
  token: string,
  defaults: Readonly<Record<string, string | boolean>>,
  toolResult: Readonly<Record<string, number>>
): string {
  const settings = readToml(content);
  const otel = settings.otel === undefined ? tomlTable() : requireObject(settings.otel);
  settings.otel = otel;
  const missing = Object.fromEntries(
    Object.entries(defaults).filter(([key]) => otel[key] === undefined)
  );
  Object.assign(otel, missing);
  let next = Object.keys(missing).length
    ? addTomlTable(content, "otel", stringify(missing), settings)
    : content;
  const result = otel.tool_result === undefined ? tomlTable() : requireObject(otel.tool_result);
  const resultDefaults = Object.fromEntries(
    Object.entries(toolResult).filter(([key]) => result[key] === undefined)
  );
  if (Object.keys(resultDefaults).length) {
    otel.tool_result = Object.assign(result, resultDefaults);
    next = addTomlTable(next, "otel.tool_result", stringify(resultDefaults), settings);
  }
  for (const [signal, endpoint] of Object.entries(exporters)) {
    const exporter = otel[signal] === undefined ? {} : requireObject(otel[signal]);
    if (Object.keys(exporter).some((name) => name !== "otlp-http")) {
      throw new Error(`Conflicting OTLP exporter: otel.${signal}. Resolve it before initializing.`);
    }
    const http = exporter["otlp-http"] === undefined ? {} : requireObject(exporter["otlp-http"]);
    const fields: Record<string, string | { authorization: string }> = {};
    for (const [key, value] of Object.entries({ endpoint, protocol: "json" })) {
      rejectConflict(`otel.${signal}.${key}`, http[key], value);
      if (http[key] === undefined) fields[key] = value;
    }
    let body = stringify(fields);
    if (http.headers === undefined) {
      fields.headers = Object.setPrototypeOf({ authorization: `Bearer ${token}` }, null);
      body += `headers = { authorization = ${JSON.stringify(`Bearer ${token}`)} }\n`;
    } else {
      const headers = requireObject(http.headers);
      const auth = Object.entries(headers).filter(
        ([name]) => name.toLowerCase() === "authorization"
      );
      if (auth.length !== 1 || auth[0][1] !== `Bearer ${token}`) {
        throw new Error(
          `Conflicting OTLP authorization: otel.${signal}. Resolve it before initializing.`
        );
      }
    }
    if (Object.keys(fields).length === 0) continue;
    otel[signal] = tomlTable({ "otlp-http": tomlTable({ ...http, ...fields }) });
    next = addTomlTable(next, `otel.${signal}.otlp-http`, body, settings);
  }
  return next;
}
