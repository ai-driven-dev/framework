import { readFileSync } from "node:fs";
import { join } from "node:path";

interface ServerExchange {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly status: number;
  readonly response: string;
}

interface ServerRecording {
  readonly version: string;
  readonly banner: string;
  readonly steps: readonly ServerExchange[];
}

const RECORDING = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "fixtures",
  "hosts",
  "kimi-0.42.0",
  "server-exchanges.json"
);

/** What the host's plugin server printed and answered, as captured from the real binary. */
function recorded(): ServerRecording {
  return JSON.parse(readFileSync(RECORDING, "utf-8"));
}

export const SERVER_RECORDING = recorded();

/** The captured exchange, by the step it was recorded under. */
export function exchangeOf(id: string): ServerExchange {
  const found = SERVER_RECORDING.steps.find((step) => step.id === id);
  if (found === undefined) throw new Error(`no recorded exchange '${id}'`);
  return found;
}
