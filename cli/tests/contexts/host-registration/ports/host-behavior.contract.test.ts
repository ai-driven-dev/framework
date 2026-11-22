import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type HostRecording,
  hostVersion,
  recordHost,
} from "../../../../scripts/host-recording.mjs";
import {
  describeHostBehaviorContract,
  type RecordedHost,
  statusesOf,
} from "../testing/recorded-host-behavior.contract.js";

const HOSTS_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures", "hosts");
const HOSTS: readonly RecordedHost[] = ["claude", "codex", "copilot"];
const COMPARE_TIMEOUT_MS = 300000;

/** The newest recording of a host; versions sort by their numeric parts. */
function recorded(host: RecordedHost): HostRecording {
  const versions = readdirSync(HOSTS_DIR)
    .filter((name) => name.startsWith(`${host}-`))
    .map((name) => name.slice(host.length + 1))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const newest = versions.at(-1);
  if (newest === undefined) throw new Error(`no recording of ${host}`);
  return JSON.parse(
    readFileSync(join(HOSTS_DIR, `${host}-${newest}`, "observations.json"), "utf-8")
  );
}

describeHostBehaviorContract("the recorded outputs", recorded);

/** Opt in with `AIDD_HOST_CONTRACT=1`: it drives the real binaries, in a throwaway HOME, over
 * local marketplaces and no model. Never part of pre-commit. A host not installed is skipped. */
const optedIn = process.env.AIDD_HOST_CONTRACT === "1";
const installed = new Set<RecordedHost>(
  optedIn ? HOSTS.filter((host) => hostVersion(host) !== undefined) : []
);
const live = new Map<RecordedHost, HostRecording>();

function recordedLive(host: RecordedHost): HostRecording {
  const existing = live.get(host);
  if (existing !== undefined) return existing;
  const recording = recordHost(host);
  live.set(host, recording);
  return recording;
}

describe.runIf(optedIn)("against the installed host binaries", () => {
  describeHostBehaviorContract(
    "the live host",
    recordedLive,
    (host) => !installed.has(host),
    COMPARE_TIMEOUT_MS
  );

  for (const host of HOSTS) {
    it.skipIf(!installed.has(host))(
      `${host}: answers each recorded step with the recorded exit status`,
      () => {
        expect(statusesOf(recordedLive(host))).toEqual(statusesOf(recorded(host)));
      },
      COMPARE_TIMEOUT_MS
    );
  }
});
