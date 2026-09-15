import { describe, expect, it } from "vitest";
import {
  diagnoseTelemetryClaims,
  type TelemetryClaim,
  type TelemetryClaimId,
  type TelemetryClaimJournal,
  type TelemetryClaimToolRead,
  type TelemetryEvidence,
} from "../../../../src/contexts/telemetry/domain/telemetry-claim.js";

const RUNS_DIR_LABEL = "aidd_docs/runs";
const CODEX_CONFIG = "/home/.codex/config.toml";

function journal(overrides: Partial<TelemetryClaimJournal> = {}): TelemetryClaimJournal {
  return { vendorId: undefined, sessionStartAt: undefined, turnClosed: false, ...overrides };
}

function toolRead(overrides: Partial<TelemetryClaimToolRead> = {}): TelemetryClaimToolRead {
  return { tool: "claude", sessionFound: false, hasIntervals: false, records: [], ...overrides };
}

function evidence(overrides: Partial<TelemetryEvidence> = {}): TelemetryEvidence {
  return {
    journals: [],
    toolReads: [],
    runsDirLabel: RUNS_DIR_LABEL,
    recorderDeclared: false,
    recorderDeclarationReadable: true,
    foreignSchemaVersions: [],
    ...overrides,
  };
}

function claimOf(overrides: Partial<TelemetryEvidence>, id: TelemetryClaimId): TelemetryClaim {
  const found = diagnoseTelemetryClaims(evidence(overrides)).find((c) => c.claim === id);
  if (found === undefined) throw new Error(`no ${id} claim`);
  return found;
}

describe("the hook-fired claim, word for word", () => {
  it("names the newest session_start across every anchored run file, whatever order they came in", () => {
    const hookFired = claimOf(
      {
        journals: [
          journal({ vendorId: "s-1", sessionStartAt: "2026-08-20T09:00:00Z" }),
          journal({ vendorId: "s-2" }),
          journal({ vendorId: "s-3", sessionStartAt: "2026-07-01T09:00:00Z" }),
        ],
        currentSessionId: "s-1",
      },
      "hook-fired"
    );

    expect(hookFired).toStrictEqual({
      claim: "hook-fired",
      verdict: "ok",
      reason: "session-anchored",
      detail: "3 run file(s), most recent session_start 2026-08-20T09:00:00Z",
    });
  });

  it("says the session_start was unreadable when no anchored run file carries one", () => {
    const hookFired = claimOf(
      { journals: [journal({ vendorId: "s-1" })], currentSessionId: "s-1" },
      "hook-fired"
    );

    expect(hookFired.detail).toBe(
      "1 run file(s), most recent session_start an unreadable session_start"
    );
  });

  it("anchors this session on its own run file even when an older session's file sits beside it", () => {
    const hookFired = claimOf(
      {
        journals: [
          journal({ vendorId: "s-old", sessionStartAt: "2026-07-01T09:00:00Z" }),
          journal({ vendorId: "s-1", sessionStartAt: "2026-08-20T09:00:00Z" }),
        ],
        currentSessionId: "s-1",
      },
      "hook-fired"
    );

    expect(hookFired.reason).toBe("session-anchored");
  });

  it("spells out the Codex trust fault, its config path and both ways out", () => {
    const hookFired = claimOf(
      {
        currentSessionId: "codex-1",
        hookTrust: { readable: true, trusted: false, configPath: CODEX_CONFIG },
      },
      "hook-fired"
    );

    expect(hookFired).toStrictEqual({
      claim: "hook-fired",
      verdict: "fail",
      reason: "untrusted-codex-hook",
      detail:
        "Codex has not trusted this plugin's hook — no trusted_hash for hooks/hooks.json:session_start " +
        "in /home/.codex/config.toml. Approve it interactively once, or pass " +
        "--dangerously-bypass-hook-trust to codex exec for a headless run.",
    });
  });

  it("names this session as having left no run file once its Codex hook is trusted", () => {
    const hookFired = claimOf(
      {
        journals: [journal({ vendorId: "s-old", sessionStartAt: "2026-07-01T09:00:00Z" })],
        currentSessionId: "codex-current",
        hookTrust: { readable: true, trusted: true, configPath: CODEX_CONFIG },
      },
      "hook-fired"
    );

    expect(hookFired).toStrictEqual({
      claim: "hook-fired",
      verdict: "fail",
      reason: "session-left-no-run-file",
      detail: "this session left no run file — the newest one is from 2026-07-01T09:00:00Z",
    });
  });

  it("adds nothing about trust to the never-fired fault when there is no trust gate", () => {
    const hookFired = claimOf({ currentSessionId: "s-1" }, "hook-fired");

    expect(hookFired.detail).toBe(
      "no run file in aidd_docs/runs — the hook has never been observed firing, and the " +
        "recorder is declared nowhere this build checks"
    );
  });

  it("adds nothing about trust to the never-fired fault when the trust state is readable", () => {
    const hookFired = claimOf(
      {
        currentSessionId: "codex-1",
        hookTrust: { readable: true, trusted: true, configPath: CODEX_CONFIG },
      },
      "hook-fired"
    );

    expect(hookFired.detail).toBe(
      "no run file in aidd_docs/runs — the hook has never been observed firing, and the " +
        "recorder is declared nowhere this build checks"
    );
  });

  it("appends the unreadable trust state, with its reason, to the never-fired fault", () => {
    const hookFired = claimOf(
      {
        currentSessionId: "codex-1",
        hookTrust: { readable: false, reason: "ENOENT" },
      },
      "hook-fired"
    );

    expect(hookFired.detail).toBe(
      "no run file in aidd_docs/runs — the hook has never been observed firing, and the " +
        "recorder is declared nowhere this build checks — Codex's own hook trust state could " +
        "not be read either (ENOENT), so this may be the same cause"
    );
  });

  it("tells a damaged declaring file apart from one that never declared the recorder", () => {
    const hookFired = claimOf(
      { currentSessionId: "s-1", recorderDeclared: false, recorderDeclarationReadable: false },
      "hook-fired"
    );

    expect(hookFired).toStrictEqual({
      claim: "hook-fired",
      verdict: "unknown",
      reason: "recorder-declaration-unreadable",
      detail:
        "no run file in aidd_docs/runs yet, and whether the recorder is declared could not be " +
        "read — see recorder declared, above, for which location. A damaged declaring file is " +
        "not the same absence as one that never declared the recorder.",
    });
  });

  it("counts the anchorless run files and names the two causes, never a hook that did not fire", () => {
    const hookFired = claimOf(
      { currentSessionId: "s-1", journals: [journal(), journal()] },
      "hook-fired"
    );

    expect(hookFired).toStrictEqual({
      claim: "hook-fired",
      verdict: "fail",
      reason: "anchorless-run-file",
      detail:
        "2 run file(s) in aidd_docs/runs, but none carry a readable session_start to anchor " +
        "them — a torn write, or a hooks block that registers another event without " +
        "SessionStart, never a hook that has not fired",
    });
  });

  it("lists the foreign schema versions once each, ascending, beside the count of files", () => {
    const hookFired = claimOf(
      { currentSessionId: "s-1", foreignSchemaVersions: [3, 2, 3, 1] },
      "hook-fired"
    );

    expect(hookFired).toStrictEqual({
      claim: "hook-fired",
      verdict: "fail",
      reason: "journal-in-another-schema",
      detail:
        "4 run file(s) in aidd_docs/runs written under a schema this build does not read " +
        "(1, 2, 3) — a journal from another version of the plugin, never a hook that did not fire",
    });
  });

  it("spells out the missing anchor beside the newest session_start", () => {
    const hookFired = claimOf(
      { journals: [journal({ vendorId: "s-1", sessionStartAt: "2026-08-20T09:00:00Z" })] },
      "hook-fired"
    );

    expect(hookFired).toStrictEqual({
      claim: "hook-fired",
      verdict: "unknown",
      reason: "no-session-anchor",
      detail:
        "1 run file(s), most recent session_start 2026-08-20T09:00:00Z — no session anchor " +
        "available to tell whether this session's hook fired",
    });
  });
});

describe("the session-journalled claim, word for word", () => {
  it("has nothing to read without a run file", () => {
    expect(claimOf({}, "session-journalled")).toStrictEqual({
      claim: "session-journalled",
      verdict: "unknown",
      reason: "no-run-file-to-read",
      detail: "no run file to read",
    });
  });

  it("counts the run files that carry only session_start", () => {
    expect(
      claimOf(
        { journals: [journal({ vendorId: "s-1" }), journal({ vendorId: "s-2" })] },
        "session-journalled"
      )
    ).toStrictEqual({
      claim: "session-journalled",
      verdict: "fail",
      reason: "only-session-start",
      detail: "2 run file(s), all carrying only session_start — nothing closed the turn",
    });
  });

  it("counts the closed turns against the anchored run files", () => {
    expect(
      claimOf(
        {
          journals: [
            journal({ vendorId: "s-1", turnClosed: true }),
            journal({ vendorId: "s-2" }),
            journal({ vendorId: "s-3", turnClosed: true }),
          ],
        },
        "session-journalled"
      )
    ).toStrictEqual({
      claim: "session-journalled",
      verdict: "ok",
      reason: "turn-closed",
      detail: "2 of 3 run file(s) carry more than session_start",
    });
  });
});

describe("the tool-files-readable claim, word for word", () => {
  it("has no session to look for when the journal names none", () => {
    expect(claimOf({}, "tool-files-readable")).toStrictEqual({
      claim: "tool-files-readable",
      verdict: "unknown",
      reason: "no-session-named",
      detail: "no session named by the journal",
    });
  });

  it("names every covered tool once and every journalled session when none was found", () => {
    expect(
      claimOf(
        {
          journals: [journal({ vendorId: "s-1" }), journal({ vendorId: "s-2" })],
          toolReads: [
            toolRead({ tool: "claude" }),
            toolRead({ tool: "codex" }),
            toolRead({ tool: "claude" }),
          ],
        },
        "tool-files-readable"
      )
    ).toStrictEqual({
      claim: "tool-files-readable",
      verdict: "fail",
      reason: "no-session-found-for-any-tool",
      detail:
        "no session found for any journalled session, across every covered tool (claude, codex) " +
        "— while the journal names s-1, s-2",
    });
  });

  it("appends the failed attempts, quoting the last error, when none was found", () => {
    expect(
      claimOf(
        {
          journals: [journal({ vendorId: "s-1" })],
          toolReads: [
            toolRead({ tool: "claude", error: "EACCES" }),
            toolRead({ tool: "codex", error: "ENOENT" }),
          ],
        },
        "tool-files-readable"
      ).detail
    ).toBe(
      "no session found for any journalled session, across every covered tool (claude, codex) " +
        "— while the journal names s-1 — 2 read attempt(s) failed: ENOENT"
    );
  });

  it("tallies each tool's reads, joined by a semicolon, with no failure suffix when none failed", () => {
    expect(
      claimOf(
        {
          journals: [journal({ vendorId: "s-1" })],
          toolReads: [
            toolRead({ tool: "claude", sessionFound: true }),
            toolRead({ tool: "claude", sessionFound: false }),
            toolRead({ tool: "codex", sessionFound: false }),
          ],
        },
        "tool-files-readable"
      )
    ).toStrictEqual({
      claim: "tool-files-readable",
      verdict: "ok",
      reason: "session-found",
      detail: "claude: 1 of 2 session(s) read; codex: 0 of 1 session(s) read",
    });
  });

  it("counts the reads a tool could not make beside the ones it made", () => {
    expect(
      claimOf(
        {
          journals: [journal({ vendorId: "s-1" })],
          toolReads: [
            toolRead({ tool: "claude", sessionFound: true }),
            toolRead({ tool: "claude", error: "EACCES" }),
            toolRead({ tool: "claude", error: "ENOENT" }),
          ],
        },
        "tool-files-readable"
      ).detail
    ).toBe("claude: 1 of 3 session(s) read, 2 could not be read");
  });
});

describe("the records-join claim, word for word", () => {
  it("has nothing to join without a record", () => {
    expect(claimOf({ toolReads: [toolRead()] }, "records-join")).toStrictEqual({
      claim: "records-join",
      verdict: "unknown",
      reason: "no-record-to-join",
      detail: "no record read to join",
    });
  });

  it("has no join material without an interval or a tool-stated step", () => {
    expect(
      claimOf(
        { toolReads: [toolRead({ records: [{ stepAttribution: "unattributed" }] })] },
        "records-join"
      )
    ).toStrictEqual({
      claim: "records-join",
      verdict: "unknown",
      reason: "no-join-material",
      detail: "no step interval and no tool-stated step — see session journalled",
    });
  });

  it("takes one read's intervals as join material for every read's records", () => {
    expect(
      claimOf(
        {
          toolReads: [
            toolRead({ tool: "claude", hasIntervals: true }),
            toolRead({ tool: "codex", records: [{ stepAttribution: "unattributed" }] }),
          ],
        },
        "records-join"
      )
    ).toStrictEqual({
      claim: "records-join",
      verdict: "fail",
      reason: "all-unattributed",
      detail: "1 record(s) found, joined: 0 — every record unattributed",
    });
  });

  it("takes a single tool-stated record as join material, with no interval at all", () => {
    expect(
      claimOf(
        {
          toolReads: [
            toolRead({
              records: [
                { stepAttribution: "unattributed" },
                { stepAttribution: "tool-stated" },
                { stepAttribution: "unattributed" },
              ],
            }),
          ],
        },
        "records-join"
      )
    ).toStrictEqual({
      claim: "records-join",
      verdict: "ok",
      reason: "records-joined",
      detail: "1 of 3 record(s) joined a step, 2 unattributed",
    });
  });
});
