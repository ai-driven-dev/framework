/**
 * Debt only shrinks. All tolerated debt is `kinds-debt.json`; this test reads it at the head and at
 * the merge-base with the branch this one merges into, and an entry the head holds that the base
 * does not fails. A fix removes an entry, so no change can list a new violation to make a test
 * pass.
 *
 * An entry is its text. An entry ending `: <n>` is a file with the number it was measured with:
 * the file is its name, and the number may not rise. A debt list the base does not hold is not
 * compared, and neither is a base without the file (its first introduction). Where git cannot
 * give a base, the test fails: a ratchet that skips is not one.
 *
 * The base is the merge-base of `HEAD` with `ARCH_BASE_REF`, else with `origin/` and the branch a
 * pull request targets (`GITHUB_BASE_REF`), else with `origin/next`. A stacked branch names its
 * parent branch.
 *
 * Limits: a list is held only by its name in the debt file, so a list kept in a test file under
 * another name is not held; the second test below refuses the one name this suite used for them.
 * A rename of a debt list restarts it: review owns it.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, REPO_ROOT } from "./helpers.js";

const DEBT_PATH = "tests/architecture/kinds-debt.json";
const DEBT_PATH_IN_REPO = `cli/${DEBT_PATH}`;
const NOT_A_LIST = "closesWhen";
const DEFAULT_BASE_BRANCH = "next";
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;

type Lists = ReadonlyMap<string, readonly string[]>;

/** The ref a change is compared with: the one named, else the branch a pull request merges into. */
function baseRef(env: NodeJS.ProcessEnv = process.env): string {
  const { ARCH_BASE_REF, GITHUB_BASE_REF } = env;
  return ARCH_BASE_REF || `origin/${GITHUB_BASE_REF || DEFAULT_BASE_BRANCH}`;
}

/** The lists of a debt file: every key that holds an array of strings. */
function listsOf(debt: object): Lists {
  return new Map(
    Object.entries(debt).flatMap(([name, value]): [string, readonly string[]][] =>
      name !== NOT_A_LIST && Array.isArray(value) && value.every((e) => typeof e === "string")
        ? [[name, value]]
        : []
    )
  );
}

/** The lists of the text of a debt file. */
function parsed(text: string): Lists {
  const raw: unknown = JSON.parse(text);
  return typeof raw === "object" && raw !== null ? listsOf(raw) : new Map();
}

/** An entry as its name and its number, when it ends `: <n>`. */
function parts(entry: string): { name: string; number: number | null } {
  const match = /^(.*): (\d+)$/.exec(entry);
  return match
    ? { name: match[1] ?? entry, number: Number(match[2]) }
    : { name: entry, number: null };
}

/** What the head lists that the base does not, or lists with a smaller number. */
function growth(head: Lists, base: Lists | null): string[] {
  if (base === null) return [];
  return [...head].flatMap(([list, entries]) => {
    const before = base.get(list);
    if (before === undefined) return [];
    const held = new Map(before.map((entry) => [parts(entry).name, parts(entry).number]));
    return entries.flatMap((entry) => {
      const { name, number } = parts(entry);
      if (!held.has(name))
        return [`${list}: "${entry}" is not in the debt at the base: debt only shrinks`];
      const was = held.get(name);
      return number !== null && was !== null && was !== undefined && number > was
        ? [`${list}: "${name}" records ${number} and the base records ${was}: debt only shrinks`]
        : [];
    });
  });
}

/** The problems of the head against the base debt, or against a base git could not give. */
function verdict(head: Lists, base: Lists | null | "unreachable", ref: string): string[] {
  return base === "unreachable"
    ? [`no merge-base with ${ref}: run \`git fetch origin\` or name another ref in ARCH_BASE_REF`]
    : growth(head, base);
}

/** The environment of a child that must not act on this repository through inherited `GIT_*`. */
function plainEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith("GIT_")));
}

function git(root: string, args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    env: plainEnvironment(),
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function mergeBase(root: string, ref: string): string | null {
  try {
    return git(root, ["merge-base", "HEAD", ref]).trim();
  } catch {
    return null;
  }
}

/** The debt at `revision`, or `null` where that revision has no debt file. */
function debtAt(root: string, revision: string): Lists | null {
  if (git(root, ["ls-tree", "--name-only", revision, DEBT_PATH_IN_REPO]).trim() === "") return null;
  return parsed(git(root, ["show", `${revision}:${DEBT_PATH_IN_REPO}`]));
}

const headDebt = (): Lists => parsed(readFileSync(join(CLI_ROOT, DEBT_PATH), "utf8"));

describe("debt only shrinks", () => {
  it("holds no entry the merge-base with the branch this one merges into lacks", () => {
    const ref = baseRef();
    const base = mergeBase(REPO_ROOT, ref);
    expect(
      verdict(headDebt(), base === null ? "unreachable" : debtAt(REPO_ROOT, base), ref)
    ).toEqual([]);
  });

  it("keeps no list in a test file under the name this suite used for them", () => {
    const declaring = readdirSync(join(CLI_ROOT, "tests/architecture"), {
      recursive: true,
      encoding: "utf8",
    })
      .filter((name) => name.endsWith(".ts"))
      .filter((name) =>
        /\b(?:const|let|var)\s+\w*BASELINE\w*/.test(
          readFileSync(join(CLI_ROOT, "tests/architecture", name), "utf8")
        )
      );
    expect(declaring, "debt is a list in kinds-debt.json, not a variable").toEqual([]);
  });

  it("reads the lists of the debt file, so a check selecting none cannot pass", () => {
    expect(headDebt().size).toBeGreaterThanOrEqual(10);
  });
});

describe("the guard itself", () => {
  const lists = (debt: Record<string, string[]>): Lists => listsOf(debt);

  it("fails an entry the base does not hold", () => {
    expect(growth(lists({ thrown: ["a.ts", "new.ts"] }), lists({ thrown: ["a.ts"] }))).toEqual([
      'thrown: "new.ts" is not in the debt at the base: debt only shrinks',
    ]);
  });

  it("passes an entry gone, and one that stays", () => {
    expect(growth(lists({ thrown: ["a.ts"] }), lists({ thrown: ["a.ts", "b.ts"] }))).toEqual([]);
  });

  it("fails a number that rose for the same file, and passes one that fell", () => {
    const base = lists({ toolNames: ["a.ts: 2"] });
    expect(growth(lists({ toolNames: ["a.ts: 3"] }), base)).toEqual([
      'toolNames: "a.ts" records 3 and the base records 2: debt only shrinks',
    ]);
    expect(growth(lists({ toolNames: ["a.ts: 1"] }), base)).toEqual([]);
  });

  it("does not compare a list the base lacks, nor a base without the file", () => {
    expect(growth(lists({ fresh: ["a.ts"] }), lists({ thrown: [] }))).toEqual([]);
    expect(growth(lists({ thrown: ["a.ts"] }), null)).toEqual([]);
  });

  it("fails where git cannot give a base", () => {
    expect(verdict(lists({}), "unreachable", "origin/next")).toEqual([
      "no merge-base with origin/next: run `git fetch origin` or name another ref in ARCH_BASE_REF",
    ]);
    expect(mergeBase(REPO_ROOT, "refs/heads/this-ref-does-not-exist")).toBeNull();
  });

  it("names the base the way a pull request does", () => {
    expect(baseRef({})).toBe("origin/next");
    expect(baseRef({ GITHUB_BASE_REF: "main" })).toBe("origin/main");
    expect(baseRef({ GITHUB_BASE_REF: "main", ARCH_BASE_REF: "origin/refactor/x" })).toBe(
      "origin/refactor/x"
    );
  });
});
