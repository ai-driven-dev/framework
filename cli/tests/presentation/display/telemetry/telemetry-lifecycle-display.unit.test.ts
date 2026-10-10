import { describe, expect, it } from "vitest";
import type { ForgetResult } from "../../../../src/contexts/telemetry/application/forget/forget-telemetry-use-case.js";
import type { OnResult } from "../../../../src/contexts/telemetry/application/switch/telemetry-on-use-case.js";
import {
  printForgetResult,
  printOffResult,
  printOnResult,
} from "../../../../src/presentation/display/telemetry/telemetry-lifecycle-display.js";
import { CapturingOutput } from "../../../helpers/ports/capturing-output.js";

const ON: Extract<OnResult, { status: "on" }> = {
  status: "on",
  consentWritten: true,
  legacyConfig: "none",
  hook: { lineRemoved: false, delegateRemoved: false, stillCalledBy: [] },
  journal: { journalRemoved: false, trackedKept: false, ignoreEntryRemoved: false },
  retention: { days: 3650, short: false },
};

function on(overrides: Partial<typeof ON>): CapturingOutput {
  const output = new CapturingOutput(false);
  printOnResult(output, { ...ON, ...overrides });
  return output;
}

describe("printOnResult", () => {
  it("says measurement is on for this clone, that it is never committed, and the next step", () => {
    const output = on({});
    expect(output.at("success")).toEqual([
      "Measurement is on for this clone: `git config aidd.telemetry` is 2 in this repository's own config.",
    ]);
    expect(output.lines).toHaveLength(3);
    expect(output.lines[1]).toContain("never committed");
    expect(output.lines[1]).toContain(
      "a teammate is measured only after running `aidd telemetry on`"
    );
    expect(output.lines[2]).toMatch(/^Next: declare what you work on with /u);
    expect(output.lines[2]).toContain("aidd telemetry task <name> [--ticket <ref>]");
    expect(output.lines[2]).toContain("the aidd-telemetry plugin's hooks ask");
  });

  it("says it already was", () => {
    expect(on({ consentWritten: false }).at("success")[0]).toBe(
      "Measurement was already on for this clone."
    );
  });

  it("says what became of .aidd/config.json, and that the change may need committing", () => {
    expect(on({ legacyConfig: "block-removed" }).at("info")[1]).toContain("commit the change");
    expect(on({ legacyConfig: "file-deleted" }).at("info")[1]).toContain("commit the deletion");
    expect(on({ legacyConfig: "unparseable" }).at("warn")[0]).toContain("left as it is");
    expect(on({ legacyConfig: "none" }).lines.join("\n")).not.toContain(".aidd/config.json");
  });

  it("names each leftover it removed", () => {
    const output = on({
      hook: { lineRemoved: true, delegateRemoved: true, stillCalledBy: [] },
      journal: { journalRemoved: true, trackedKept: false, ignoreEntryRemoved: true },
    });
    expect(output.at("info").slice(1, 5)).toEqual([
      "Removed the commit hook line the previous version added.",
      "Removed the script that line called.",
      "Removed aidd_docs/runs/, the previous version's journal.",
      "Removed its aidd_docs/runs/ entry from .gitignore.",
    ]);
  });

  it("prints the manual step when a manager still calls the script", () => {
    const output = on({
      hook: {
        lineRemoved: true,
        delegateRemoved: false,
        stillCalledBy: ["lefthook.yml", ".husky/prepare-commit-msg"],
      },
    });
    const warning = output.at("warn")[0] ?? "";
    expect(warning).toContain("lefthook.yml, .husky/prepare-commit-msg");
    expect(warning).toContain("aidd-session-trailer.sh");
  });

  it("says a tracked journal was left", () => {
    expect(
      on({ journal: { journalRemoved: false, trackedKept: true, ignoreEntryRemoved: false } }).at(
        "warn"
      )[0]
    ).toContain("tracked by git");
  });

  it("prints the one line to add when Claude keeps transcripts too briefly", () => {
    const warning = on({ retention: { days: 30, short: true } }).at("warn")[0] ?? "";
    expect(warning).toContain("30 days (its default)");
    expect(warning).toContain('"cleanupPeriodDays": 3650');
  });

  it("does not call a chosen retention the default, and keeps singular", () => {
    expect(on({ retention: { days: 7, short: true } }).at("warn")[0]).toContain("for 7 days, and");
    expect(on({ retention: { days: 1, short: true } }).at("warn")[0]).toContain("for 1 day, and");
  });

  it("explains each refusal", () => {
    const output = new CapturingOutput(false);
    printOnResult(output, { status: "refused", reason: "outside-repository" });
    printOnResult(output, { status: "refused", reason: "unreadable-git-config" });
    expect(output.at("error")[0]).toContain("not inside a git repository");
    expect(output.at("error")[1]).toContain("git config cannot be read");
  });
});

describe("printOffResult", () => {
  it("says what stays", () => {
    const output = new CapturingOutput(false);
    printOffResult(output, { status: "off", changed: true });
    expect(output.at("success")[0]).toContain("aidd telemetry forget --yes");
  });

  it("says it was not on", () => {
    const output = new CapturingOutput(false);
    printOffResult(output, { status: "off", changed: false });
    expect(output.at("success")[0]).toContain("was not on");
  });

  it("explains a refusal", () => {
    const output = new CapturingOutput(false);
    printOffResult(output, { status: "refused", reason: "outside-repository" });
    expect(output.at("error")[0]).toContain("not inside a git repository");
  });
});

const PLAN = {
  entries: [
    { kind: "ledger", path: "/t/ledger", files: 3 },
    { kind: "previous-day-file", path: "/t/2026-10-05.jsonl", files: 1 },
  ],
  repositories: [
    { root: "/w/a", taskKeys: 2, consent: true },
    { root: "/w/b", taskKeys: 0, consent: false },
  ],
  missing: ["/w/gone"],
  unlocated: 1,
} as const;

function forgotten(result: ForgetResult): CapturingOutput {
  const output = new CapturingOutput(false);
  printForgetResult(output, result);
  return output;
}

describe("printForgetResult", () => {
  it("lists everything that would go, and says nothing was removed", () => {
    const output = forgotten({ status: "preview", plan: PLAN });
    expect(output.lines).toContain("  - the ledger of billed calls: /t/ledger (3 files)");
    expect(output.lines).toContain(
      "  - day files of the previous version: /t/2026-10-05.jsonl (1 file)"
    );
    expect(output.lines).toContain("  - 2 branch task keys in the git config of /w/a");
    expect(output.lines).toContain("  - the consent (aidd.telemetry) in the git config of /w/a");
    expect(output.lines.join("\n")).not.toContain("/w/b");
    expect(output.at("warn")).toEqual([
      "Skipped /w/gone: it is gone, or is no longer that repository.",
      "1 repository declared a task and could not be located.",
    ]);
    expect(output.lines.at(-1)).toContain("Nothing was removed. Run `aidd telemetry forget --yes`");
  });

  it("reports what was removed", () => {
    const output = forgotten({ status: "forgotten", plan: PLAN });
    expect(output.at("success")).toEqual(["Removed:"]);
    expect(output.lines.join("\n")).not.toContain("Nothing was removed");
  });

  it("says when nothing is kept, preview or not", () => {
    const empty = { entries: [], repositories: [], missing: [], unlocated: 0 };
    expect(forgotten({ status: "preview", plan: empty }).lines).toEqual([
      "Nothing measured is kept on this machine.",
    ]);
    expect(forgotten({ status: "forgotten", plan: empty }).lines).toEqual([
      "Nothing measured is kept on this machine.",
    ]);
  });

  it("still names a repository it skipped when nothing else is kept", () => {
    const output = forgotten({
      status: "preview",
      plan: { entries: [], repositories: [], missing: ["/w/x"], unlocated: 0 },
    });
    expect(output.at("warn")).toHaveLength(1);
  });

  it("labels every kind of thing it lists", () => {
    const kinds = [
      "ledger",
      "bindings",
      "identity",
      "previous-day-file",
      "previous-identity",
    ] as const;
    const plan = {
      entries: kinds.map((kind) => ({ kind, path: `/p/${kind}`, files: 1 })),
      repositories: [],
      missing: [],
      unlocated: 0,
    };
    expect(forgotten({ status: "preview", plan }).lines.slice(1, 6)).toEqual([
      "  - the ledger of billed calls: /p/ledger (1 file)",
      "  - the declarations kept beside it: /p/bindings (1 file)",
      "  - your identity: /p/identity (1 file)",
      "  - day files of the previous version: /p/previous-day-file (1 file)",
      "  - the previous version's identity: /p/previous-identity (1 file)",
    ]);
  });

  it("is not empty when only declarations remain, or only files remain", () => {
    const keysOnly = {
      entries: [],
      repositories: [{ root: "/w/a", taskKeys: 1, consent: false }],
      missing: [],
      unlocated: 0,
    };
    const filesOnly = {
      entries: [{ kind: "identity", path: "/i", files: 1 }],
      repositories: [],
      missing: [],
      unlocated: 0,
    } as const;
    expect(forgotten({ status: "preview", plan: keysOnly }).lines[0]).toBe("This would remove:");
    expect(forgotten({ status: "preview", plan: filesOnly }).lines[0]).toBe("This would remove:");
    expect(forgotten({ status: "preview", plan: keysOnly }).lines[1]).toBe(
      "  - 1 branch task key in the git config of /w/a"
    );
  });
});
