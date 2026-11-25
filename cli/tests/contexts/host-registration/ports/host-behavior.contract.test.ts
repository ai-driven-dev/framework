import { describe, expect, it } from "vitest";
import {
  type HostRecording,
  hostVersion,
  recordHost,
} from "../../../../scripts/host-recording.mjs";
import { newestRecording } from "../testing/recorded-host.builder.js";
import {
  describeHostBehaviorContract,
  type RecordedHost,
  statusesOf,
} from "../testing/recorded-host-behavior.contract.js";

const HOSTS: readonly RecordedHost[] = ["claude", "codex", "copilot"];
const COMPARE_TIMEOUT_MS = 300000;

describeHostBehaviorContract("the recorded outputs", newestRecording);

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
        expect(statusesOf(recordedLive(host))).toEqual(statusesOf(newestRecording(host)));
      },
      COMPARE_TIMEOUT_MS
    );
  }
});
