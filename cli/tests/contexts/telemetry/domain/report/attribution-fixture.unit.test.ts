import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseBranchConfig,
  snapshotKey,
} from "../../../../../src/contexts/telemetry/domain/branch-binding.js";
import { branchRoleOf } from "../../../../../src/contexts/telemetry/domain/declaration/branch-role.js";
import {
  parseSessionCarry,
  parseSessionDeclaration,
} from "../../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import { attribute } from "../../../../../src/contexts/telemetry/domain/report/attribution.js";
import { REPOSITORY_ROOT } from "../../../../helpers/repository-root.js";

/** The hook answers what a session is bound to at one instant, to decide whether to ask. The
 * report answers what a call belongs to, once everything has been declared. They agree on every
 * case of the shared fixture but the two below, which are where the report knows more. */
const FIXTURE = join(REPOSITORY_ROOT, "scripts", "__tests__", "fixtures", "telemetry-bindings");
const text = (name: string): string => readFileSync(join(FIXTURE, name), "utf8");
const lines = (name: string): string[] => text(name).split("\n").filter(Boolean);

interface Case {
  session_id: string | null;
  at: string;
  gitConfig: string | null;
  head: string | null;
  originHead: string | null;
}
interface Config {
  branch: string;
  keys: Record<string, string>;
}
const cases = JSON.parse(text("cases.json")) as {
  gitConfig: Record<string, Config>;
  binding: Record<string, Case>;
};
const expected = JSON.parse(text("expected.json")).binding as Record<
  string,
  { state: string; task?: string | null; ticket?: string | null; none?: boolean }
>;
const declarations = lines("sessions.jsonl").flatMap((line) => parseSessionDeclaration(line) ?? []);
const carries = lines("carries.jsonl").flatMap((line) => parseSessionCarry(line) ?? []);

function branchOutput(config: Config): string {
  return Object.entries(config.keys)
    .map(([variable, value]) => `branch.${config.branch}.${variable.toLowerCase()}\n${value}\0`)
    .join("");
}

function reportAnswer(input: Case) {
  const config = input.gitConfig === null ? null : cases.gitConfig[input.gitConfig];
  const working = branchRoleOf(input.head, input.originHead) === "working";
  const binding =
    config !== null && config !== undefined && working
      ? (parseBranchConfig(branchOutput(config))[0] ?? null)
      : null;
  const branches = new Map(
    binding === null
      ? []
      : [
          [
            snapshotKey("r", binding.branch),
            { ...binding, repository_id: "r", branch_created_at: null, snapshot_at: input.at },
          ],
        ]
  );
  return attribute(
    {
      session_id: input.session_id ?? "no-session",
      at: input.at,
      git_branch: binding?.branch ?? null,
      repository_id: "r",
    },
    { declarations, carries, branches }
  );
}

function hookAnswer(name: string) {
  const answer = expected[name];
  if (answer?.state !== "bound") return { state: "unattributed", reason: "no-binding" };
  if (answer.none === true) return { state: "unattributed", reason: "declared-none" };
  return { state: "attributed", task: answer.task, ticket: answer.ticket };
}

const DIVERGES = {
  // The report moves the whole carried session to its first declaration; the hook can only
  // say what was true at the moment it was asked.
  "carried-then-declared-before-own-declaration": {
    state: "attributed",
    task: "own-after-carry",
    ticket: null,
  },
  // A call cannot predate its own session's carry; the hook is asked at a moment, the report
  // is asked about a whole session.
  "carried-before-the-carry-falls-to-branch": {
    state: "attributed",
    task: "checkout-fix",
    ticket: "PROJ-12",
  },
} as const;

describe("the report agrees with the hook's fixture", () => {
  it.each(Object.entries(cases.binding).filter(([name]) => !(name in DIVERGES)))(
    "attributes %s as the hook binds it",
    (name, input) => {
      expect(reportAnswer(input)).toEqual(hookAnswer(name));
    }
  );

  it.each(Object.entries(DIVERGES))("knows more than the hook for %s", (name, answer) => {
    expect(reportAnswer(cases.binding[name] as Case)).toEqual(answer);
  });
});
