import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants as osConstants } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { claudeConfigDir } from "../../domain/claude-projects-root.js";
import claudeTemplate from "./claude-dev.json" with { type: "json" };
import codexTemplate from "./codex-dev.json" with { type: "json" };
import {
  mergeCodexExporters,
  mergeJsonEnvironment,
  mergeOpenCodeInstrumentation,
  openCodeInstrumentation,
  rejectConflict,
} from "./config-edits.js";
import opencodeTemplate from "./opencode-dev.json" with { type: "json" };

export const OPENCODE_CONFIG_ID = "opencode";
export const OTEL_CONFIGS = ["claude", "codex", OPENCODE_CONFIG_ID] as const;
export const OTEL_ENDPOINTS = ["dev", "prod"] as const;
type Config = (typeof OTEL_CONFIGS)[number];
type Endpoint = (typeof OTEL_ENDPOINTS)[number];

interface Host {
  readonly home: string;
  readonly env: NodeJS.ProcessEnv;
  readonly opencodeVersion?: () => Promise<string>;
}

interface Edit {
  readonly path: string;
  readonly initial: string;
  readonly update: (content: string) => string;
  readonly launch: string;
  readonly containsToken?: false;
}

const COLLECTOR = "http://127.0.0.1:14318";
const TOKEN_PATH = ".local/share/aidd-otel-observation/collector-token";
const SIGNALS = ["LOGS", "METRICS", "TRACES"] as const;

function interpolate(template: Readonly<Record<string, string>>, token: string) {
  return Object.fromEntries(
    Object.entries(template).map(([key, value]) => [
      key,
      value.replace("{collector}", COLLECTOR).replace("{token}", token),
    ])
  );
}

async function readToken(home: string): Promise<string> {
  try {
    const handle = await open(join(home, TOKEN_PATH), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await handle.stat();
      if (!info.isFile() || (info.mode & 0o077) !== 0) throw new Error();
      const token = (await handle.readFile("utf8")).trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(token)) throw new Error();
      return token;
    } finally {
      await handle.close();
    }
  } catch {
    throw new Error(`A valid private collector token is required at ~/${TOKEN_PATH} (mode 0600).`);
  }
}

function claudeEdit(host: Host, token: string): Edit {
  const additions = interpolate(claudeTemplate.env, token);
  return {
    path: join(claudeConfigDir(host.env.CLAUDE_CONFIG_DIR, host.home), "settings.json"),
    initial: "{}\n",
    launch: "Restart Claude Code to apply the configuration.",
    update: (content) =>
      mergeJsonEnvironment(
        content,
        additions,
        (env) => {
          rejectConflict(
            "OTEL_EXPORTER_OTLP_ENDPOINT",
            env.OTEL_EXPORTER_OTLP_ENDPOINT,
            `${COLLECTOR}/claude`
          );
          for (const signal of SIGNALS) {
            for (const key of ["HEADERS", "PROTOCOL"]) {
              const name = `OTEL_EXPORTER_OTLP_${signal}_${key}`;
              rejectConflict(name, env[name], additions[`OTEL_EXPORTER_OTLP_${key}`]);
            }
          }
        },
        claudeTemplate.defaults
      ),
  };
}

async function openCodeVersion(host: Host): Promise<"1" | "2"> {
  let output: string;
  try {
    output = host.opencodeVersion
      ? await host.opencodeVersion()
      : (
          await promisify(execFile)(OPENCODE_CONFIG_ID, ["--version"], {
            env: host.env,
            timeout: 5000,
          })
        ).stdout;
  } catch {
    throw new Error("Cannot determine OpenCode version. Make opencode available on PATH.");
  }
  const version = /^\s*(?:opencode\s+)?v?([12])\.(\d+)\.(\d+)\s*$/i.exec(output);
  if (version && (version[1] === "1" || version[1] === "2")) {
    const minimumMinor = version[1] === "1" ? 19 : 2;
    const minor = Number(version[2]);
    if (minor > minimumMinor || (minor === minimumMinor && Number(version[3]) >= 5)) {
      return version[1];
    }
  }
  throw new Error(
    "Unsupported OpenCode version. Use an OpenCode 1 release from 1.19.5 or 2 from 2.2.5."
  );
}

function openCodeGlobalDir(host: Host): string {
  return join(host.env.XDG_CONFIG_HOME || join(host.home, ".config"), OPENCODE_CONFIG_ID);
}

async function openCodeV1Edit(host: Host): Promise<Edit> {
  const global = openCodeGlobalDir(host);
  const custom = host.env.OPENCODE_CONFIG_DIR;
  const initial = "{}\n";
  const nativeFiles = ["opencode.json", "opencode.jsonc"];
  const files = ["config.json", ...nativeFiles].map((name) => join(global, name));
  if (host.env.OPENCODE_CONFIG) files.push(host.env.OPENCODE_CONFIG);
  if (custom && custom !== global) files.push(...nativeFiles.map((name) => join(custom, name)));
  let path: string | undefined;
  let flag: unknown;
  for (const file of new Set(files)) {
    const existing = await readSettings(file, initial);
    if (!existing.exists) continue;
    path = file;
    const value = openCodeInstrumentation(existing.content);
    if (value !== undefined) flag = value;
  }
  if (host.env.OPENCODE_CONFIG_CONTENT) {
    const inline = openCodeInstrumentation(host.env.OPENCODE_CONFIG_CONTENT);
    if (inline !== undefined) flag = inline;
  }
  if (flag !== undefined && flag !== true) {
    throw new Error("OpenCode experimental.openTelemetry is disabled or invalid.");
  }
  return {
    path: path ?? join(custom || global, nativeFiles[0]),
    initial,
    launch:
      "Run OpenCode 1 with aidd telemetry otel run --config=opencode -- [OpenCode arguments].",
    containsToken: false,
    update: (content) =>
      flag === true && openCodeInstrumentation(content) === undefined
        ? content
        : mergeOpenCodeInstrumentation(content, opencodeTemplate.experimental.openTelemetry),
  };
}

async function openCodeEdit(host: Host, token: string): Promise<Edit> {
  if ((await openCodeVersion(host)) === "1") return openCodeV1Edit(host);
  const directory = host.env.OPENCODE_CONFIG_DIR || openCodeGlobalDir(host);
  const additions = interpolate(opencodeTemplate.env, token);
  return {
    path: join(directory, "service.json"),
    initial: "{}\n",
    launch: "Restart the OpenCode background service with opencode service restart.",
    update: (content) => mergeJsonEnvironment(content, additions, () => {}),
  };
}

export async function runOtelOpenCode(args: readonly string[], host: Host): Promise<number> {
  if ((await openCodeVersion(host)) !== "1") {
    throw new Error("OTLP launch is for OpenCode 1. Use the background service with OpenCode 2.");
  }
  const edit = await openCodeV1Edit(host);
  const current = await readSettings(edit.path, edit.initial);
  if (edit.update(current.content) !== current.content) {
    throw new Error(
      "Initialize OpenCode 1 OTLP with aidd telemetry otel init --config=opencode --endpoint=dev."
    );
  }
  const token = await readToken(host.home);
  const additions = interpolate(opencodeTemplate.env, token);
  for (const [key, value] of Object.entries(additions))
    rejectConflict(key, host.env[key] || undefined, value);
  const child = spawn(OPENCODE_CONFIG_ID, args, {
    env: { ...host.env, ...additions },
    stdio: "inherit",
  });
  const interrupt = () => child.kill("SIGINT");
  const terminate = () => child.kill("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  try {
    return await new Promise((resolve, reject) => {
      child.once("error", () => reject(new Error("Could not launch OpenCode.")));
      child.once("exit", (code, signal) =>
        resolve(code ?? (signal ? 128 + osConstants.signals[signal] : 1))
      );
    });
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
}

async function readSettings(path: string, initial: string) {
  const info = await lstat(path).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!info) return { content: initial, private: false, exists: false };
  if (!info.isFile()) throw new Error("OTLP configuration must be a regular file.");
  return {
    content: await readFile(path, "utf8"),
    private: (info.mode & 0o077) === 0,
    exists: true,
  };
}

async function applyEdit(edit: Edit): Promise<boolean> {
  const before = await readSettings(edit.path, edit.initial);
  const next = edit.update(before.content);
  if (next === before.content && (before.private || edit.containsToken === false)) return false;

  await mkdir(dirname(edit.path), { recursive: true, mode: 0o700 });
  const lockPath = `${edit.path}.aidd-otel.lock`;
  const lock = await open(lockPath, "wx", 0o600);
  try {
    const current = await readSettings(edit.path, edit.initial);
    if (
      current.content !== before.content ||
      current.private !== before.private ||
      current.exists !== before.exists
    ) {
      throw new Error("OTLP settings changed during initialization. Retry with the updated file.");
    }
    const temporary = `${edit.path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, next, { flag: "wx", mode: 0o600 });
      await rename(temporary, edit.path);
    } finally {
      await rm(temporary, { force: true });
    }
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
  return true;
}

export async function initializeOtel(config: Config, endpoint: Endpoint, host: Host) {
  if (endpoint === "prod") {
    throw new Error(
      "OTLP production configuration is unavailable until the Gouvernail endpoint is published."
    );
  }
  if (process.platform === "win32") {
    throw new Error("OTLP initialization requires private POSIX configuration files.");
  }
  const token = await readToken(host.home);
  let edit: Edit;
  switch (config) {
    case "claude":
      edit = claudeEdit(host, token);
      break;
    case "codex":
      edit = {
        path: join(host.env.CODEX_HOME || join(host.home, ".codex"), "config.toml"),
        initial: "",
        launch: "Restart Codex to apply the configuration.",
        update: (content) =>
          mergeCodexExporters(
            content,
            interpolate(codexTemplate.exporters, token),
            token,
            codexTemplate.defaults,
            codexTemplate.toolResult
          ),
      };
      break;
    case OPENCODE_CONFIG_ID:
      edit = await openCodeEdit(host, token);
      break;
  }
  return { path: edit.path, launch: edit.launch, changed: await applyEdit(edit) };
}
