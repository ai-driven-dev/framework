import { describe, expect, it } from "vitest";
import type { HostRecording, RecordedStep } from "../../../../scripts/host-recording.mjs";

export type RecordedHost = "claude" | "codex" | "copilot";

/** What a host's CLI did in a recording, per host, or `undefined` where it cannot be had. */
export type RecordingSource = (host: RecordedHost) => HostRecording | undefined;

function stepOf(recording: HostRecording | undefined, id: string): RecordedStep {
  const step = recording?.steps.find((candidate) => candidate.id === id);
  if (step === undefined) throw new Error(`no recorded step '${id}'`);
  return step;
}

const outputOf = (step: RecordedStep): string => `${step.stdout}${step.stderr}`;

/**
 * The host behaviours the adapters and the withdrawal rely on, each one measured against the real
 * binary. Run over the recorded outputs, and over a live host where one is installed, so a host
 * that changes breaks the same case in both.
 */
export function describeHostBehaviorContract(
  subjectName: string,
  recordingOf: RecordingSource,
  skipHost: (host: RecordedHost) => boolean = () => false,
  timeoutMs?: number
): void {
  describe(`when the host behaviour is ${subjectName}`, () => {
    it.skipIf(skipHost("claude"))(
      "claude: adding another source under a registered name overwrites installLocation without error",
      () => {
        const recording = recordingOf("claude");
        const first = stepOf(recording, "add-first-source");
        const second = stepOf(recording, "add-second-source");

        expect([first.status, second.status]).toEqual([0, 0]);
        const installLocationAfter = (step: RecordedStep): string =>
          JSON.parse(step.files[".claude/plugins/known_marketplaces.json"] ?? "{}")["mk-one"]
            .installLocation;
        expect(installLocationAfter(first)).toBe("<markets>/a");
        expect(installLocationAfter(second)).toBe("<markets>/b");
      },
      timeoutMs
    );

    it.skipIf(skipHost("claude"))(
      "claude: refuses an uninstall whose scope differs from the install's",
      () => {
        const recording = recordingOf("claude");
        const refused = stepOf(recording, "uninstall-user-scope");

        expect(refused.status).toBe(1);
        expect(outputOf(refused)).toContain("is installed in local scope, not user");
        const installed = JSON.parse(stepOf(recording, "plugin-list-after-refusal").stdout);
        expect(
          installed.map((plugin: { id: string; scope: string }) => [plugin.id, plugin.scope])
        ).toEqual([["p@mk-one", "local"]]);
        expect(stepOf(recording, "uninstall-local-scope").status).toBe(0);
      },
      timeoutMs
    );

    it.skipIf(skipHost("codex"))(
      "codex: remove leaves an empty shell of the marketplace in the cache",
      () => {
        const recording = recordingOf("codex");

        expect(stepOf(recording, "install").tree).toContain("cx-one/p/1.0.0");
        const removed = stepOf(recording, "remove");
        expect(removed.status).toBe(0);
        expect(removed.tree).toEqual(["cx-one"]);
      },
      timeoutMs
    );

    it.skipIf(skipHost("codex"))(
      "codex: upgrade refuses a local marketplace",
      () => {
        const refused = stepOf(recordingOf("codex"), "upgrade-local-marketplace");

        expect(refused.status).toBe(1);
        expect(outputOf(refused)).toContain("is not configured as a Git marketplace");
      },
      timeoutMs
    );

    it.skipIf(skipHost("copilot"))(
      "copilot: a marketplace update exits 1 on a local path that is gone, and 0 while it resolves",
      () => {
        const recording = recordingOf("copilot");

        expect(stepOf(recording, "update-marketplace-present").status).toBe(0);
        const vanished = stepOf(recording, "update-marketplace-vanished");
        expect(vanished.status).toBe(1);
        expect(outputOf(vanished)).toContain("Local marketplace path does not exist");
      },
      timeoutMs
    );
  });
}

/** Whether two recordings of one host agree on every step's exit status: the drift a host
 * version bump must not hide. */
export function statusesOf(recording: HostRecording): [string, number | null][] {
  return recording.steps.map((step) => [step.id, step.status]);
}
