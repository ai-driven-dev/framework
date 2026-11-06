import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import openCodePlugin from "../../../../../../assets/configs/otel-opencode-plugin.js.txt";
import { asPlainObject } from "../../../../../kernel/reading/plain-object.js";
import claude from "../config/claude.json" with { type: "json" };
import codex from "../config/codex.json" with { type: "json" };
import {
  CLAUDE_CONFIG_ID,
  CODEX_CONFIG_ID,
  type Config,
  OPENCODE_CONFIG_ID,
  readToken,
} from "../settings.js";
import { startOtelCollector } from "./collect.js";
import { hasOpenCodePlugin } from "./opencode-plugin-file.js";
import {
  type OpenCodePluginLog,
  openCodePluginLogs,
  relatedOpenCodeLogs,
} from "./opencode-plugin-logs.js";
import { destination, sessionIdsInCapture, syncOtel } from "./sync.js";

type RunOptions = {
  config: Config;
  endpoint: string;
  tenant: string;
  token: string;
  cwd: string;
  prompt: string;
  model?: string;
  retainCapture?: (path: string) => void;
  signal: AbortSignal;
};

async function provider(options: RunOptions, collector: string, token: string, directory: string) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("OTEL_") && key !== "AIDD_OTEL_TOKEN"
    )
  );
  env.AIDD_TELEMETRY = "0";
  const model = options.model ? ["--model", options.model] : [];
  if (options.config === CLAUDE_CONFIG_ID) {
    const settings: Record<string, string> = {};
    for (const [key, value] of Object.entries(claude.env)) {
      settings[key] = value.replace("{collector}", collector).replace("{token}", token);
    }
    for (const key of Object.keys(claude.defaults)) {
      if (key.startsWith("OTEL_LOG_")) settings[key] = "0";
    }
    settings.OTEL_TRACES_EXPORTER = "none";
    settings.OTEL_METRIC_EXPORT_INTERVAL = "1000";
    settings.OTEL_LOGS_EXPORT_INTERVAL = "1000";
    settings.OTEL_METRICS_INCLUDE_REPOSITORY = "false";
    const file = join(directory, "claude-settings.json");
    await writeFile(file, JSON.stringify({ env: settings }), { mode: 0o600, flag: "wx" });
    return {
      env: { ...env, ...settings },
      args: [
        "--print",
        "--no-session-persistence",
        "--settings",
        file,
        ...model,
        "--",
        options.prompt,
      ],
    };
  }
  if (options.config === CODEX_CONFIG_ID) {
    const overrides = Object.entries(codex.exporters).flatMap(([key, url]) => [
      "-c",
      `otel.${key}={otlp-http={endpoint="${url.replace("{collector}", collector)}",protocol="json",headers={authorization="Bearer ${token}"}}}`,
    ]);
    return {
      env,
      args: [
        "exec",
        "--ephemeral",
        ...model,
        ...overrides,
        "-c",
        "otel.log_user_prompt=false",
        "-",
      ],
      input: options.prompt,
    };
  }
  const hasInstalledPlugin = await hasOpenCodePlugin({ home: homedir(), env: process.env });
  if (!hasInstalledPlugin) {
    const pluginDir = join(directory, "opencode-plugin");
    await mkdir(pluginDir, { mode: 0o700 });
    await writeFile(join(pluginDir, "index.js"), openCodePlugin, { mode: 0o600, flag: "wx" });
    let inline: Record<string, unknown> = {};
    if (env.OPENCODE_CONFIG_CONTENT) {
      try {
        const parsed = asPlainObject(JSON.parse(env.OPENCODE_CONFIG_CONTENT));
        if (!parsed) throw new Error();
        inline = parsed;
      } catch {
        throw new Error(
          "OPENCODE_CONFIG_CONTENT must be a JSON object to enable OpenCode telemetry for this run."
        );
      }
    }
    if (inline.plugins !== undefined && !Array.isArray(inline.plugins))
      throw new Error("OpenCode inline plugins must be an array.");
    env.OPENCODE_CONFIG_CONTENT = JSON.stringify({
      ...inline,
      plugins: [...(inline.plugins ?? []), pluginDir],
    });
  }
  return {
    env: {
      ...env,
      OTEL_EXPORTER_OTLP_ENDPOINT: `${collector}/${OPENCODE_CONFIG_ID}`,
      OTEL_EXPORTER_OTLP_HEADERS: `Authorization=Bearer ${token}`,
      AIDD_OPENCODE_OTEL_LOGS_ENDPOINT: `${collector}/${OPENCODE_CONFIG_ID}/v1/logs`,
      AIDD_OPENCODE_OTEL_HEADERS: `Authorization=Bearer ${token}`,
    },
    args: ["run", "--standalone", ...model, "--", options.prompt],
  };
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function attributes(value: unknown) {
  const values = new Map<string, string | number>();
  for (const entry of list(value)) {
    const row = asPlainObject(entry);
    const content = asPlainObject(row?.value);
    const item = content?.stringValue ?? content?.intValue;
    if (typeof row?.key === "string" && (typeof item === "string" || typeof item === "number")) {
      if (values.has(row.key)) return new Map<string, string | number>();
      values.set(row.key, item);
    }
  }
  return values;
}

function validSpanTimes(start: unknown, end: unknown): boolean {
  if (
    typeof start !== "string" ||
    typeof end !== "string" ||
    !/^[1-9]\d{0,19}$/.test(start) ||
    !/^[1-9]\d{0,19}$/.test(end)
  )
    return false;
  return BigInt(start) <= BigInt(end) && BigInt(end) <= 18446744073709551615n;
}

export function openCodePromptSpans(line: string): unknown[] {
  const envelope = asPlainObject(JSON.parse(line));
  if (envelope?.signal !== "traces") return [];
  const payload = asPlainObject(envelope.payload);
  const result = [];
  for (const item of list(payload?.resourceSpans)) {
    const resource = asPlainObject(item);
    const a = attributes(asPlainObject(resource?.resource)?.attributes);
    const version = a.get("service.version");
    if (
      a.get("service.name") !== OPENCODE_CONFIG_ID ||
      typeof version !== "string" ||
      !/^2\.\d+\.\d+$/.test(version)
    )
      continue;
    for (const scope of list(resource?.scopeSpans)) {
      for (const raw of list(asPlainObject(scope)?.spans)) {
        const span = asPlainObject(raw);
        const b = attributes(span?.attributes);
        const path = b.get("url.path");
        const route = "/api/session/:sessionID/prompt";
        const kind = span?.kind;
        if (
          (kind !== 2 && kind !== "SPAN_KIND_SERVER") ||
          b.get("http.route") !== route ||
          b.get("http.request.method") !== "POST" ||
          ![200, "200"].includes(b.get("http.response.status_code") ?? "") ||
          typeof path !== "string" ||
          !/^\/api\/session\/ses_[A-Za-z0-9]{1,64}\/prompt$/.test(path) ||
          typeof span?.traceId !== "string" ||
          !/^[a-f0-9]{32}$/i.test(span.traceId) ||
          typeof span.spanId !== "string" ||
          !/^[a-f0-9]{16}$/i.test(span.spanId) ||
          span.name !== "POST" ||
          !validSpanTimes(span.startTimeUnixNano, span.endTimeUnixNano)
        )
          continue;
        const string = (key: string, value: string) => ({ key, value: { stringValue: value } });
        result.push({
          resourceSpans: [
            {
              resource: {
                attributes: [
                  string("service.name", OPENCODE_CONFIG_ID),
                  string("service.version", version),
                ],
              },
              scopeSpans: [
                {
                  spans: [
                    {
                      traceId: span.traceId,
                      spanId: span.spanId,
                      name: span.name,
                      kind,
                      startTimeUnixNano: span.startTimeUnixNano,
                      endTimeUnixNano: span.endTimeUnixNano,
                      attributes: [
                        string("http.route", route),
                        string("http.request.method", "POST"),
                        string("url.path", path),
                        { key: "http.response.status_code", value: { intValue: "200" } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        });
      }
    }
  }
  return result;
}

async function retainCapture(home: string, capture: string, config: Config): Promise<string> {
  const retained = join(home, `${config}.jsonl`);
  try {
    await rename(capture, retained);
    await rm(join(home, ".local"), { recursive: true });
    await rm(join(home, "opencode-plugin"), { recursive: true, force: true });
    await rm(join(home, "claude-settings.json"), { force: true });
    return retained;
  } catch (error) {
    await rm(home, { recursive: true, force: true });
    throw error;
  }
}

/** Consent covers this one invocation and its isolated collector only. */
export async function runOtel(options: RunOptions): Promise<number> {
  if (process.env.AIDD_TELEMETRY === "0") throw new Error("AIDD telemetry is disabled.");
  if (!options.prompt.trim()) throw new Error("Pass a nonempty prompt.");
  if (options.model && !/^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,127}$/.test(options.model)) {
    throw new Error("Provider model ID is invalid.");
  }
  const config = options.config === OPENCODE_CONFIG_ID ? CODEX_CONFIG_ID : options.config;
  const base = { ...options, config, session: "validation", home: "", follow: false };
  const origin = destination(base, "logs").origin;
  if (options.signal.aborted) throw new Error("OTLP execution was cancelled.");
  const home = await mkdtemp(join(tmpdir(), "aidd-otel-run-"));
  const capture = join(home, ".local/share/aidd-otel-observation", `${options.config}.jsonl`);
  let captureCreated = false;
  try {
    const collector = await startOtelCollector({ home, port: 0 });
    captureCreated = true;
    try {
      const launch = await provider(
        options,
        `http://127.0.0.1:${collector.port}`,
        await readToken(home),
        home
      );
      const code = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(options.config, launch.args, {
          cwd: options.cwd,
          env: launch.env,
          signal: options.signal,
          stdio: [launch.input ? "pipe" : "ignore", "inherit", "inherit"],
        });
        child.on("error", reject);
        child.on("close", resolve);
        child.stdin?.on("error", reject);
        child.stdin?.end(launch.input);
      });
      if (code !== 0) throw new Error(`${options.config} execution did not complete successfully.`);
    } finally {
      await collector.close();
    }
    const lines = createInterface({ input: createReadStream(capture), crlfDelay: Infinity });
    let sent = 0;
    if (options.config === OPENCODE_CONFIG_ID) {
      const url = new URL(
        `/api/kpi/otel/${OPENCODE_CONFIG_ID}/${options.tenant}/v1/traces`,
        origin
      );
      let selected: unknown;
      const logs: OpenCodePluginLog[] = [];
      let rootSession: string | undefined;
      for await (const line of lines) {
        if (!line.trim()) continue;
        for (const payload of openCodePromptSpans(line)) {
          if (selected)
            throw new Error("The isolated OpenCode run emitted more than one prompt span.");
          selected = payload;
          const resource = asPlainObject(list(asPlainObject(payload)?.resourceSpans)[0]);
          const scope = asPlainObject(list(resource?.scopeSpans)[0]);
          const span = asPlainObject(list(scope?.spans)[0]);
          const path = attributes(span?.attributes).get("url.path");
          if (typeof path !== "string") throw new Error("OpenCode prompt session is missing.");
          rootSession = path.split("/")[3];
        }
        for (const log of openCodePluginLogs(line)) {
          logs.push(log);
        }
      }
      if (!rootSession || !selected)
        throw new Error(
          "OpenCode prompt trace is missing; session attribution cannot be verified."
        );
      const related = relatedOpenCodeLogs(rootSession, logs);
      if (related.length !== logs.length)
        console.warn(
          "OpenCode observations from sessions without a proven parent were not forwarded."
        );
      if (!related.some((log) => log.session === rootSession))
        throw new Error("OpenCode telemetry plugin did not emit any session observations.");
      const logsBody = JSON.stringify({
        resourceLogs: related.flatMap((log) => list(asPlainObject(log.payload)?.resourceLogs)),
      });
      if (Buffer.byteLength(logsBody, "utf8") > 2 * 1024 * 1024)
        throw new Error(
          "OpenCode observations exceed the receiver's 2 MiB limit; nothing was sent."
        );
      if (selected) {
        const response = await fetch(url, {
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.any([options.signal, AbortSignal.timeout(15000)]),
          headers: {
            authorization: `Bearer ${options.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(selected),
        });
        if (!response.ok)
          throw new Error(`Gouvernail rejected OpenCode traces: HTTP ${response.status}.`);
        const receipt = asPlainObject(await response.json());
        if (receipt?.accepted !== 1 || Object.keys(receipt).length !== 1)
          throw new Error("Gouvernail did not retain the OpenCode span.");
        sent++;
      }
      const logsUrl = new URL(
        `/api/kpi/otel/${OPENCODE_CONFIG_ID}/${options.tenant}/v1/logs`,
        origin
      );
      try {
        const response = await fetch(logsUrl, {
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.any([options.signal, AbortSignal.timeout(15000)]),
          headers: { authorization: `Bearer ${options.token}`, "content-type": "application/json" },
          body: logsBody,
        });
        if (!response.ok)
          throw new Error(`Gouvernail rejected OpenCode logs: HTTP ${response.status}.`);
        const receipt = asPlainObject(await response.json());
        if (receipt?.accepted !== related.length || Object.keys(receipt).length !== 1)
          throw new Error("Gouvernail did not retain all OpenCode observations.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "OpenCode logs could not be sent.";
        throw new Error(`${message} The prompt trace may already have been retained.`);
      }
      sent += related.length;
    } else {
      const sessions = new Set<string>();
      for await (const line of lines) {
        if (line.trim())
          for (const session of sessionIdsInCapture(line, config)) sessions.add(session);
      }
      if (sessions.size > 1)
        throw new Error("The isolated run emitted more than one OTLP session.");
      for (const session of sessions) {
        const result = await syncOtel(
          { ...base, session, home },
          async () => {
            if (options.signal.aborted) throw new Error("OTLP execution was cancelled.");
          },
          async () => !options.signal.aborted
        );
        sent += result.sent;
      }
    }
    return sent;
  } finally {
    if (captureCreated && options.retainCapture) {
      options.retainCapture(await retainCapture(home, capture, options.config));
    } else {
      await rm(home, { recursive: true, force: true });
    }
  }
}
