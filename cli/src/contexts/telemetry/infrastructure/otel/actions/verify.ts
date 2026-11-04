import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { readSettings } from "../files.js";
import { transformCapturedLine } from "../observations.js";
import {
  type Config,
  configurationEdit,
  type Endpoint,
  type Host,
  OPENCODE_CONFIG_ID,
} from "../settings.js";

export async function verifyOtel(config: Config, endpoint: Endpoint, host: Host) {
  const edit = await configurationEdit(config, endpoint, host);
  const current = await readSettings(edit.path, edit.initial);
  if (
    (!current.exists && edit.containsToken !== false) ||
    edit.update(current.content) !== current.content
  ) {
    throw new Error("OTLP configuration is not initialized. Run aidd telemetry otel init first.");
  }
  if (!current.private && edit.containsToken !== false) {
    throw new Error("OTLP configuration must be private (mode 0600).");
  }
  const capture = join(host.home, ".local/share/aidd-otel-observation", `${config}.jsonl`);
  const handle = await open(
    capture,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  ).catch((error) => {
    if (error.code === "ENOENT")
      throw new Error("No OTLP capture found. Run a tool session and retry.");
    throw error;
  });
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error("OTLP capture must be a regular file.");
    let lines = 0;
    let observations = 0;
    let unrecognisedLines = 0;
    for await (const line of handle.readLines({ autoClose: false })) {
      if (!line.trim()) continue;
      lines++;
      const count = transformCapturedLine(config, line).length;
      observations += count;
      if (count === 0) unrecognisedLines++;
    }
    if (lines === 0) throw new Error("OTLP capture is empty. Run a tool session and retry.");
    let eventLines = 0;
    if (config === OPENCODE_CONFIG_ID) {
      const eventsPath = join(
        host.home,
        ".local/share/aidd-otel-observation",
        OPENCODE_CONFIG_ID,
        "events.jsonl"
      );
      const events = await open(
        eventsPath,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
      ).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (events) {
        try {
          if (!(await events.stat()).isFile())
            throw new Error("OpenCode event capture must be a regular file.");
          for await (const line of events.readLines({ autoClose: false })) {
            if (!line.trim()) continue;
            eventLines++;
            const count = transformCapturedLine(config, line).length;
            observations += count;
            if (count === 0) unrecognisedLines++;
          }
        } finally {
          await events.close();
        }
      }
    }
    return {
      path: edit.path,
      capture,
      lines,
      eventLines,
      observations,
      unrecognisedLines,
      modifiedAt: info.mtime.toISOString(),
    };
  } finally {
    await handle.close();
  }
}
