/**
 * The payloads the hosts really sent their hooks, captured once and scrubbed: the one reader every
 * test of a host's payload goes through.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPOSITORY_ROOT } from "../../../shared/testing/repository-root.builder.js";

const PAYLOADS = join(REPOSITORY_ROOT, "scripts", "__tests__", "fixtures", "hook-payloads");

/** The project folder every capture names, once scrubbed. */
export const SCRUBBED_PROJECT = "/Users/user/project";
/** The session every capture names, once scrubbed. */
export const SESSION = "00000000-0000-4000-8000-000000000000";

/** The capture file of what `host` sent its `hook`, the hook spelled as the host spells it. */
export function captureFile(host: string, hook: string): string {
  return `${host}-${hook}.json`;
}

export interface CapturedSample<T = Record<string, unknown>> {
  readonly run: string;
  readonly payload: T;
  readonly hookAnswer: Record<string, unknown> | null;
}

/** The samples a capture file holds. Given `project`, the scrubbed project folder names it. */
export function capturedSamples<T = Record<string, unknown>>(
  file: string,
  project?: string
): readonly CapturedSample<T>[] {
  const raw = readFileSync(join(PAYLOADS, file), "utf8");
  // Replaced inside the JSON text, so the folder goes in JSON-escaped: a Windows path's backslashes.
  const text =
    project === undefined
      ? raw
      : raw.replaceAll(SCRUBBED_PROJECT, JSON.stringify(project).slice(1, -1));
  return (JSON.parse(text) as { samples: CapturedSample<T>[] }).samples;
}

/** The first sample of a capture file that `matches`; `what` names it when none does. Given
 * `project`, the scrubbed project folder names it. */
export function capturedSample<T = Record<string, unknown>>(
  file: string,
  matches: (sample: CapturedSample<T>, index: number) => boolean,
  what: string,
  project?: string
): CapturedSample<T> {
  const found = capturedSamples<T>(file, project).find(matches);
  if (found === undefined) throw new Error(`${file} has no ${what}`);
  return found;
}

/** What `host` handed each hook in the captured `run`, by hook: `of(hook)` is that hook's first
 * sample. Given `project`, the scrubbed project folder names it. */
export function capturedRunOf<T = unknown>(
  host: string,
  run: string,
  project?: string
): (hook: string) => T {
  return (hook) =>
    capturedSample<T>(
      captureFile(host, hook),
      (sample) => sample.run === run,
      `${run} sample`,
      project
    ).payload;
}
