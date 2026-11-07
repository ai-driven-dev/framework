import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, open, rename, rm, writeFile } from "node:fs/promises";
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
import { attachInstallationId, checkInstallationClaim } from "./installation-attribute.js";
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
  followUp?: string;
  includeRepository?: boolean;
  installationId?: string;
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
    settings.OTEL_METRICS_INCLUDE_REPOSITORY = options.includeRepository ? "true" : "false";
    const file = join(directory, "claude-settings.json");
    await writeFile(file, JSON.stringify({ env: settings }), { mode: 0o600, flag: "wx" });
    return {
      env: { ...env, ...settings },
      args: [
        "--print",
        ...(options.followUp ? ["--session-id", randomUUID()] : ["--no-session-persistence"]),
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
        ...(options.followUp ? ["--json"] : ["--ephemeral"]),
        ...model,
        ...overrides,
        "-c",
        "otel.log_user_prompt=false",
        "-",
      ],
      input: options.prompt,
    };
  }
  if (options.followUp) {
    const databaseDir = join(directory, "opencode-data");
    await mkdir(databaseDir, { mode: 0o700 });
    env.OPENCODE_DB = join(databaseDir, "session.db");
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
    args: [
      "run",
      "--standalone",
      ...(options.followUp ? ["--session", `ses_${randomBytes(16).toString("hex")}`] : []),
      ...model,
      "--",
      options.prompt,
    ],
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
    await rm(join(home, "opencode-data"), { recursive: true, force: true });
    await rm(join(home, "claude-settings.json"), { force: true });
    return retained;
  } catch (error) {
    await rm(home, { recursive: true, force: true });
    throw error;
  }
}

function promptSession(payload: unknown): string | undefined {
  const resource = asPlainObject(list(asPlainObject(payload)?.resourceSpans)[0]);
  const scope = asPlainObject(list(resource?.scopeSpans)[0]);
  const span = asPlainObject(list(scope?.spans)[0]);
  const path = attributes(span?.attributes).get("url.path");
  return typeof path === "string" ? path.split("/")[3] : undefined;
}

/** Find the last complete JSONL record without consuming an in-progress append. */
export async function completeCaptureEnd(capture: string, start: number): Promise<number> {
  const file = await open(capture, "r");
  try {
    let end = (await file.stat()).size;
    const buffer = Buffer.alloc(4096);
    while (end > start) {
      const length = Math.min(buffer.length, end - start);
      const offset = end - length;
      const { bytesRead } = await file.read(buffer, 0, length, offset);
      const newline = buffer.subarray(0, bytesRead).lastIndexOf(10);
      if (newline >= 0) return offset + newline + 1;
      end = offset;
    }
    return start;
  } finally {
    await file.close();
  }
}

async function captureSessions(capture: string, config: Config, start: number) {
  const end = await completeCaptureEnd(capture, start);
  const sessions = new Set<string>();
  const prompts = new Set<string>();
  const usage = new Set<string>();
  if (end <= start) return { end, sessions, usage };
  const lines = createInterface({
    input: createReadStream(capture, { start, end: end - 1 }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    if (config === OPENCODE_CONFIG_ID) {
      for (const payload of openCodePromptSpans(line)) {
        const session = promptSession(payload);
        if (session) sessions.add(session);
      }
      for (const log of openCodePluginLogs(line)) {
        const resource = asPlainObject(list(asPlainObject(log.payload)?.resourceLogs)[0]);
        const scope = asPlainObject(list(resource?.scopeLogs)[0]);
        const record = asPlainObject(list(scope?.logRecords)[0]);
        const fields = attributes(record?.attributes);
        const message = fields.get("assistant.message.id");
        if (fields.get("event.name") === "session.step.ended" && typeof message === "string")
          usage.add(`${log.session}:${message}`);
      }
    } else {
      for (const session of sessionIdsInCapture(line, config)) sessions.add(session);
      const envelope = asPlainObject(JSON.parse(line));
      for (const resource of list(asPlainObject(envelope?.payload)?.resourceLogs)) {
        for (const scope of list(asPlainObject(resource)?.scopeLogs)) {
          for (const record of list(asPlainObject(scope)?.logRecords)) {
            const fields = attributes(asPlainObject(record)?.attributes);
            const name = fields.get("event.name");
            const prompt = fields.get("prompt.id");
            if (config === CLAUDE_CONFIG_ID && typeof prompt === "string") {
              if (name === "user_prompt") prompts.add(prompt);
              if (name === "api_request") usage.add(prompt);
            }
            if (
              config === CODEX_CONFIG_ID &&
              name === "codex.sse_event" &&
              fields.get("event.kind") === "response.completed" &&
              fields.has("input_token_count") &&
              fields.has("output_token_count")
            )
              usage.add(String(fields.get("event.timestamp") ?? "completed"));
          }
        }
      }
    }
  }
  if (config === CLAUDE_CONFIG_ID)
    for (const item of usage) if (!prompts.has(item)) usage.delete(item);
  return { end, sessions, usage };
}

async function waitForUsage(
  capture: string,
  config: Config,
  start: number,
  expected: string,
  signal: AbortSignal
) {
  const deadline = Date.now() + 10_000;
  while (true) {
    const observation = await captureSessions(capture, config, start);
    if (config === OPENCODE_CONFIG_ID)
      for (const item of observation.usage)
        if (!item.startsWith(`${expected}:`)) observation.usage.delete(item);
    if (
      observation.sessions.size === 1 &&
      observation.sessions.has(expected) &&
      observation.usage.size > 0
    )
      return observation;
    if (Date.now() >= deadline || signal.aborted)
      throw new Error(
        "The provider did not emit a completed usage observation for the expected session."
      );
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
}

function requireSession(sessions: Set<string>, expected: string): void {
  if (sessions.size !== 1 || !sessions.has(expected))
    throw new Error("The execution did not emit exactly the expected OTLP session.");
}

async function executeProvider(input: {
  config: Config;
  args: string[];
  env: NodeJS.ProcessEnv;
  cwd: string;
  prompt?: string;
  signal: AbortSignal;
  codexJson: boolean;
}): Promise<string | undefined> {
  let thread: string | undefined;
  let invalidThread = false;
  const code = await new Promise<number | null>((resolve, reject) => {
    const child = spawn(input.config, input.args, {
      cwd: input.cwd,
      env: input.env,
      signal: input.signal,
      stdio: [input.prompt ? "pipe" : "ignore", input.codexJson ? "pipe" : "inherit", "inherit"],
    });
    if (child.stdout) {
      const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
      lines.on("line", (line) => {
        let event: Record<string, unknown> | null = null;
        try {
          event = asPlainObject(JSON.parse(line));
        } catch {
          invalidThread = true;
          return;
        }
        if (event?.type === "thread.started") {
          const value = event.thread_id;
          if (
            thread ||
            typeof value !== "string" ||
            !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
          )
            invalidThread = true;
          else thread = value;
        }
        const item = asPlainObject(event?.item);
        if (
          event?.type === "item.completed" &&
          item?.type === "agent_message" &&
          typeof item.text === "string"
        )
          process.stdout.write(`${item.text}\n`);
      });
    }
    child.on("error", reject);
    child.on("close", resolve);
    child.stdin?.on("error", reject);
    child.stdin?.end(input.prompt);
  });
  if (code !== 0) throw new Error(`${input.config} execution did not complete successfully.`);
  if (input.codexJson && (!thread || invalidThread))
    throw new Error("Codex did not report exactly one valid session ID.");
  return thread;
}

function resumeArgs(config: Config, first: string[], session: string, prompt: string): string[] {
  if (config === CODEX_CONFIG_ID) return ["exec", "resume", ...first.slice(1, -1), session, "-"];
  const args = [...first];
  if (config === CLAUDE_CONFIG_ID) args[args.indexOf("--session-id")] = "--resume";
  args[args.length - 1] = prompt;
  return args;
}

/** Consent covers this one invocation and its isolated collector only. */
export async function runOtel(options: RunOptions): Promise<number> {
  if (process.env.AIDD_TELEMETRY === "0") throw new Error("AIDD telemetry is disabled.");
  if (!options.prompt.trim()) throw new Error("Pass a nonempty prompt.");
  if (options.followUp !== undefined && !options.followUp.trim())
    throw new Error("Pass a nonempty follow-up prompt.");
  if (options.includeRepository && options.config !== CLAUDE_CONFIG_ID)
    throw new Error("Repository metadata is only supported for Claude Code.");
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
      const first = await executeProvider({
        config: options.config,
        args: launch.args,
        env: launch.env,
        cwd: options.cwd,
        prompt: launch.input,
        signal: options.signal,
        codexJson: !!options.followUp && options.config === CODEX_CONFIG_ID,
      });
      if (options.followUp) {
        const session =
          options.config === CODEX_CONFIG_ID
            ? first
            : launch.args[
                launch.args.indexOf(
                  options.config === CLAUDE_CONFIG_ID ? "--session-id" : "--session"
                ) + 1
              ];
        if (!session) throw new Error("The provider session is missing.");
        const firstCapture = await waitForUsage(
          capture,
          options.config,
          0,
          session,
          options.signal
        );
        requireSession(firstCapture.sessions, session);
        const second = await executeProvider({
          config: options.config,
          args: resumeArgs(options.config, launch.args, session, options.followUp),
          env: launch.env,
          cwd: options.cwd,
          prompt: options.config === CODEX_CONFIG_ID ? options.followUp : undefined,
          signal: options.signal,
          codexJson: options.config === CODEX_CONFIG_ID,
        });
        if (options.config === CODEX_CONFIG_ID && second !== session)
          throw new Error("Codex resumed a different session.");
        const secondCapture = await waitForUsage(
          capture,
          options.config,
          firstCapture.end,
          session,
          options.signal
        );
        requireSession(secondCapture.sessions, session);
        if (
          options.config !== CODEX_CONFIG_ID &&
          [...secondCapture.usage].some((id) => firstCapture.usage.has(id))
        )
          throw new Error("The follow-up did not emit a distinct usage observation.");
      }
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
      const selected: unknown[] = [];
      const logs: OpenCodePluginLog[] = [];
      let rootSession: string | undefined;
      for await (const line of lines) {
        if (!line.trim()) continue;
        if (options.installationId)
          checkInstallationClaim(JSON.parse(line), options.installationId);
        for (const payload of openCodePromptSpans(line)) {
          const session = promptSession(payload);
          if (!session || (rootSession && rootSession !== session))
            throw new Error("OpenCode prompt spans do not identify the same session.");
          rootSession = session;
          selected.push(payload);
          if (selected.length > (options.followUp ? 2 : 1))
            throw new Error("The isolated OpenCode run emitted more prompt spans than expected.");
        }
        for (const log of openCodePluginLogs(line)) {
          logs.push(log);
        }
      }
      if (!rootSession || selected.length !== (options.followUp ? 2 : 1))
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
      const logsPayload = {
        resourceLogs: related.flatMap((log) => list(asPlainObject(log.payload)?.resourceLogs)),
      };
      const logsBody = JSON.stringify(
        options.installationId
          ? attachInstallationId(logsPayload, "resourceLogs", options.installationId)
          : logsPayload
      );
      if (Buffer.byteLength(logsBody, "utf8") > 2 * 1024 * 1024)
        throw new Error(
          "OpenCode observations exceed the receiver's 2 MiB limit; nothing was sent."
        );
      for (const payload of selected) {
        const response = await fetch(url, {
          method: "POST",
          redirect: "manual",
          signal: AbortSignal.any([options.signal, AbortSignal.timeout(15000)]),
          headers: {
            authorization: `Bearer ${options.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(
            options.installationId
              ? attachInstallationId(payload, "resourceSpans", options.installationId)
              : payload
          ),
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
        if (options.config === CODEX_CONFIG_ID) {
          if (result.sent === 0)
            throw new Error("Codex session logs were not retained; turn traces were not sent.");
          try {
            const traces = await syncOtel(
              { ...base, session, home, traceOnly: true },
              async () => {
                if (options.signal.aborted) throw new Error("OTLP execution was cancelled.");
              },
              async () => !options.signal.aborted
            );
            sent += traces.sent;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Codex traces could not be sent.";
            throw new Error(`${message} Logs may already have been retained.`);
          }
        }
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
