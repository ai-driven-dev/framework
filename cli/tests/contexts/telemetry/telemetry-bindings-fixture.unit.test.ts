import { readFileSync } from "node:fs";
import { join, win32 } from "node:path";
import { describe, expect, it } from "vitest";
import { consentOfRoot } from "../../../src/contexts/telemetry/application/repository-consent.js";
import { parseBranchConfig } from "../../../src/contexts/telemetry/domain/branch-binding.js";
import { resolveBinding } from "../../../src/contexts/telemetry/domain/declaration/binding-resolution.js";
import { branchRoleOf } from "../../../src/contexts/telemetry/domain/declaration/branch-role.js";
import {
  declarationOf,
  parseSessionCarry,
  parseSessionDeclaration,
  renderSessionDeclaration,
  SESSION_CARRY_FIELDS,
  SESSION_DECLARATION_FIELDS,
} from "../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import {
  consentOf,
  refusedByEnvironment,
} from "../../../src/contexts/telemetry/domain/telemetry-consent.js";
import { telemetryDirOf } from "../../../src/runtime/wiring/telemetry.js";
import { FakeConsents } from "../../helpers/ports/in-memory-telemetry.js";
import { REPOSITORY_ROOT } from "../../helpers/repository-root.js";

/** The contract between the CLI and the plugin hooks: the hook tests read these same files. */
const FIXTURE = join(REPOSITORY_ROOT, "scripts", "__tests__", "fixtures", "telemetry-bindings");
const text = (name: string): string => readFileSync(join(FIXTURE, name), "utf8");
const lines = (name: string): string[] =>
  text(name)
    .split("\n")
    .filter((line) => line !== "");

interface GitConfigCase {
  branch: string;
  keys: Record<string, string>;
}
interface BindingCase {
  session_id: string | null;
  at: string;
  gitConfig: string | null;
  head: string | null;
  originHead: string | null;
}
interface ConsentCase {
  /** The value of `aidd.telemetry` in the clone's git config, `null` when it is not set. */
  value: string | null;
}
interface DirCase {
  platform: "posix" | "win32";
  home: string;
  env: NodeJS.ProcessEnv;
}
interface ClaudeOnlyCase {
  payload_session_id: string | null;
  env_session_id: string | null;
  transcript_path: string | null;
}
const cases = JSON.parse(text("cases.json")) as {
  gitConfig: Record<string, GitConfigCase>;
  binding: Record<string, BindingCase>;
  branchRole: Record<string, { head: string | null; originHead: string | null }>;
  consent: Record<string, ConsentCase>;
  environmentRefusal: Record<string, NodeJS.ProcessEnv>;
  telemetryDir: Record<string, DirCase>;
  claudeOnly: Record<string, ClaudeOnlyCase>;
};
const expected = JSON.parse(text("expected.json")) as Record<string, Record<string, unknown>>;

const declarations = lines("sessions.jsonl").map((line) => parseSessionDeclaration(line));
const carries = lines("carries.jsonl").map((line) => parseSessionCarry(line));

/** What `git config --local -z --get-regexp` prints for a case: the variable part of every
 * key in lower case, the branch name as it is. */
function gitConfigOutput(config: GitConfigCase): string {
  return Object.entries(config.keys)
    .map(([variable, value]) => `branch.${config.branch}.${variable.toLowerCase()}\n${value}\0`)
    .join("");
}

describe("the shared fixture of task bindings", () => {
  it("has an answer for every case and a case for every answer", () => {
    for (const section of Object.keys(expected)) {
      expect(Object.keys(expected[section] ?? {}).sort(), section).toEqual(
        Object.keys((cases as Record<string, object>)[section] ?? {}).sort()
      );
    }
    expect(Object.keys(expected).sort()).toEqual(
      Object.keys(cases)
        .filter((section) => section !== "gitConfig")
        .sort()
    );
  });

  it("holds only lines the CLI reads", () => {
    expect(declarations).not.toContain(null);
    expect(carries).not.toContain(null);
  });

  it("is written with the fields the CLI writes: a renamed field turns this red", () => {
    const written = renderSessionDeclaration(
      "s",
      declarationOf({ kind: "task", task: "t", ticket: "P-1" }, new Date(0), "command")
    );
    const writtenKeys = Object.keys(JSON.parse(written)).sort();
    expect(writtenKeys).toEqual([...SESSION_DECLARATION_FIELDS].sort());
    for (const line of lines("sessions.jsonl")) {
      expect(Object.keys(JSON.parse(line)).sort()).toEqual(writtenKeys);
    }
    for (const line of lines("carries.jsonl")) {
      expect(Object.keys(JSON.parse(line)).sort()).toEqual([...SESSION_CARRY_FIELDS].sort());
    }
  });

  it.each(Object.entries(cases.binding))("binds %s", (name, input) => {
    const config = input.gitConfig === null ? null : cases.gitConfig[input.gitConfig];
    const role = branchRoleOf(input.head, input.originHead);
    const declared =
      config === null || config === undefined || role !== "working"
        ? null
        : (parseBranchConfig(gitConfigOutput(config))[0] ?? null);
    const binding = resolveBinding({
      sessionId: input.session_id,
      at: new Date(input.at),
      declarations: declarations.filter((entry) => entry !== null),
      carries: carries.filter((entry) => entry !== null),
      branch: declared,
    });
    const answer =
      binding.state === "unbound"
        ? { state: "unbound" }
        : {
            state: "bound",
            source: binding.source,
            task: binding.task,
            ticket: binding.ticket,
            none: binding.none,
          };
    expect(answer).toEqual(expected.binding?.[name]);
  });

  it.each(Object.entries(cases.branchRole))("gives %s its role", (name, input) => {
    expect(branchRoleOf(input.head, input.originHead)).toBe(expected.branchRole?.[name]);
  });

  it.each(Object.entries(cases.consent))("reads consent %s", async (name, input) => {
    const consents = new FakeConsents();
    if (input.value !== null) consents.values.set("/work/tree", input.value);
    expect(await consentOfRoot(consents, "/work/tree")).toBe(expected.consent?.[name]);
    expect(consentOf({ kind: "value", value: input.value })).toBe(expected.consent?.[name]);
  });

  it.each(Object.entries(cases.environmentRefusal))("refuses on %s", (name, env) => {
    expect(refusedByEnvironment(env.AIDD_TELEMETRY)).toBe(expected.environmentRefusal?.[name]);
  });

  it.each(Object.entries(cases.telemetryDir))("finds the telemetry dir for %s", (name, input) => {
    const joinPath = input.platform === "win32" ? win32.join : join;
    expect(telemetryDirOf(input.env, input.home, joinPath)).toBe(expected.telemetryDir?.[name]);
  });

  it("states the Claude-only cases well formed, for the hook test to execute", () => {
    for (const [name, input] of Object.entries(cases.claudeOnly)) {
      expect(typeof expected.claudeOnly?.[name], name).toBe("boolean");
      expect(Object.keys(input).sort(), name).toEqual([
        "env_session_id",
        "payload_session_id",
        "transcript_path",
      ]);
    }
    expect(Object.values(expected.claudeOnly ?? {})).toContain(true);
    expect(Object.values(expected.claudeOnly ?? {})).toContain(false);
  });
});
