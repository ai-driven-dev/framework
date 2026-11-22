import { describe, expect, it } from "vitest";
import { ConsentLog } from "../../../../../src/contexts/telemetry/domain/consent/consent-log.js";
import { RememberedResolutions } from "../../../../../src/contexts/telemetry/domain/remembered-resolutions.js";
import {
  directoryFrom,
  type ResolutionState,
  unreadableAt,
  verdictOn,
} from "../../../../../src/contexts/telemetry/domain/resolution/resolution-judgement.js";
import { tokenOf } from "../../testing/clone.builder.js";
import { A, repository } from "../../testing/ingest-usage-setup.builder.js";

const DIR = "/work/a";
const AT = "2026-03-01T00:00:00.000Z";
const never = async () => false;

function stateOf(damaged = false): ResolutionState {
  return {
    remembered: new RememberedResolutions(new Map()),
    consents: new ConsentLog({
      events: [{ kind: "open", token: tokenOf(A), clone: A, at: "2026-01-01T00:00:00.000Z" }],
      damaged,
    }),
    unreadable: new Set(),
    caseInsensitiveFileSystem: false,
  };
}

describe("what a directory is", () => {
  it("is never seen alive when it is gone and nothing remembers it", () => {
    const { directory } = directoryFrom(
      { status: "gone" },
      { dir: DIR, at: AT },
      stateOf().remembered
    );
    expect(directory).toEqual({ skipped: "never-seen-alive" });
  });

  it("is outside any repository when git says so", () => {
    const { directory } = directoryFrom(
      { status: "outside-repository" },
      { dir: DIR, at: AT },
      stateOf().remembered
    );
    expect(directory).toEqual({ skipped: "outside-repo" });
  });

  it("is remembered as alive, in its clone, once seen in a repository", () => {
    const { directory, remembered } = directoryFrom(
      repository(DIR),
      { dir: DIR, at: AT },
      stateOf().remembered
    );
    expect("owners" in directory && directory.current).not.toBeNull();
    expect(remembered.changed).toBe(true);
  });
});

describe("a verdict no read can give yet", () => {
  it("never allows consent while the consent log is damaged", () => {
    expect(unreadableAt(stateOf(true), DIR, AT)).toEqual({
      skipped: "unreadable-consent",
      mayConsent: false,
    });
  });
});

describe("the verdict on a call", () => {
  it("gives the reason a directory was left out for", async () => {
    const state = stateOf();
    const outcome = await verdictOn(
      { skipped: "outside-repo" },
      { cwd: DIR, at: AT, closed: never },
      state
    );
    expect(outcome).toEqual({ skipped: "outside-repo" });
  });

  it("stores a call of a live clone that consented", async () => {
    const state = stateOf();
    const { directory } = directoryFrom(repository(DIR), { dir: DIR, at: AT }, state.remembered);
    const outcome = await verdictOn(directory, { cwd: DIR, at: AT, closed: never }, state);
    expect(outcome).toMatchObject({ live: true });
  });
});
