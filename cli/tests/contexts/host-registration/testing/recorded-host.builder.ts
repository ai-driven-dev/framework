import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HostRecording } from "../../../../scripts/host-recording.mjs";

const HOSTS_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures", "hosts");

/** The newest recording of a host; versions sort by their numeric parts. */
export function newestRecording(host: string): HostRecording {
  const newest = readdirSync(HOSTS_DIR)
    .filter((name) => name.startsWith(`${host}-`))
    .map((name) => name.slice(host.length + 1))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .at(-1);
  if (newest === undefined) throw new Error(`no recording of ${host}`);
  return JSON.parse(
    readFileSync(join(HOSTS_DIR, `${host}-${newest}`, "observations.json"), "utf-8")
  );
}
