import { describe, expect, it } from "vitest";
import { ConsentLog } from "../../../../../src/contexts/telemetry/domain/consent/consent-log.js";
import { RememberedResolutions } from "../../../../../src/contexts/telemetry/domain/remembered-resolutions.js";
import { resolutionKey } from "../../../../../src/contexts/telemetry/domain/repository-resolution.js";
import {
  directoryFrom,
  type ResolutionState,
  unreadableAt,
  verdictOn,
} from "../../../../../src/contexts/telemetry/domain/resolution/resolution-judgement.js";
import { tokenOf } from "../../testing/clone.builder.js";
import { A, repository } from "../../testing/ingest-usage-setup.builder.js";

const DIR = "/work/a";
const OPENED = "2026-01-01T00:00:00.000Z";
const BEFORE = "2025-12-01T00:00:00.000Z";
const AFTER = "2026-03-01T00:00:00.000Z";
const sighting = { dir: DIR, repository_id: "r", root: DIR, clone: A, seen_at: OPENED };

function stateOf(damaged = false): ResolutionState {
  return {
    remembered: new RememberedResolutions(new Map([[resolutionKey(DIR, A), sighting]])),
    consents: new ConsentLog({
      events: [{ kind: "open", token: tokenOf(A), clone: A, at: OPENED }],
      damaged,
    }),
    unreadable: new Set(),
    caseInsensitiveFileSystem: false,
  };
}

describe("a verdict no read can give yet", () => {
  it("allows consent for a directory a clone that consented was seen in", () => {
    expect(unreadableAt(stateOf(), DIR, AFTER)).toMatchObject({ mayConsent: true });
  });

  it("allows none while the consent log is damaged", () => {
    expect(unreadableAt(stateOf(true), DIR, AFTER)).toMatchObject({ mayConsent: false });
  });
});

describe("what a gone directory is", () => {
  it("is a directory seen alive before, in no clone now", () => {
    const { directory } = directoryFrom(
      { status: "gone" },
      { dir: DIR, at: () => AFTER },
      stateOf().remembered
    );
    expect(directory).toMatchObject({ current: null, owners: [{ dir: DIR }] });
  });
});

describe("the verdict on a call before its clone consented", () => {
  const verdict = async (closed: boolean) => {
    const state = stateOf();
    const { directory } = directoryFrom(
      repository(DIR),
      { dir: DIR, at: () => AFTER },
      state.remembered
    );
    return verdictOn(directory, { cwd: DIR, at: BEFORE, closed: async () => closed }, state);
  };

  it("says the consent closed when the clone's key names a closed interval", async () => {
    expect(await verdict(true)).toEqual({ skipped: "consent-closed" });
  });

  it("says there was none otherwise", async () => {
    expect(await verdict(false)).toEqual({ skipped: "no-consent" });
  });
});
