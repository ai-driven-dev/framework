import { spawn } from "node:child_process";
import { constants as osConstants } from "node:os";
import opencodeTemplate from "../config/opencode.json" with { type: "json" };
import { rejectConflict } from "../config-edits.js";
import { readSettings } from "../files.js";
import {
  type Host,
  interpolate,
  OPENCODE_CONFIG_ID,
  openCodeV1Edit,
  openCodeVersion,
  readToken,
} from "../settings.js";

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
