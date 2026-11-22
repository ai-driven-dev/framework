/**
 * The debt in `kinds-debt.json` only shrinks. It is read at the merge-base with the branch a
 * change targets (`ARCH_BASE_REF`, else `origin/` and the pull request's base, else `origin/next`)
 * and at the head: a rule, an entry or a count the base does not hold is a violation, and so is
 * a debt file the base does not have, once the base holds the kind gate. A base git cannot give
 * fails; a ratchet that skips is not one.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEBT_FILE = "kinds-debt.json";
const DEBT_FILE_NAME = /(debt|baseline|tolerat|allowlist)[^/]*\.json$/i;
// The change that brings the kind gate to a base without it may bring its debt file too: the base
// has nothing to compare with. Once the gate is in the base, a debt file it lacks is a new one.
const GATE_FILE = "kinds.ts";

type Debts = Record<string, Record<string, number>>;

function parse(text: string): Debts {
  const debts: unknown = JSON.parse(text);
  if (!Array.isArray(debts)) throw new Error(`${DEBT_FILE} is not a list`);
  return Object.fromEntries(debts.map((debt) => [debt.rule, debt.entries]));
}

/** What the head holds that the base does not: a rule, an entry, or a count above the base's. */
function grownDebt(base: Debts, head: Debts): string[] {
  return Object.entries(head).flatMap(([rule, entries]) => {
    if (!(rule in base)) return [`${rule}: a new debt`];
    return Object.entries(entries).flatMap(([file, count]) => {
      const was = base[rule]?.[file];
      if (was === undefined) return [`${rule}: a new entry ${file}`];
      return count > was ? [`${rule}: ${file} grew from ${was} to ${count}`] : [];
    });
  });
}

/** The debt files the head has and the base has not. */
function newDebtFiles(base: readonly string[], head: readonly string[]): string[] {
  return head.filter((file) => DEBT_FILE_NAME.test(file) && !base.includes(file));
}

const git = (...args: string[]): string =>
  execFileSync("git", args, { cwd: HERE, encoding: "utf-8", stdio: "pipe" }).trim();

function baseCommit(): string {
  const ref = process.env.ARCH_BASE_REF || `origin/${process.env.GITHUB_BASE_REF || "next"}`;
  try {
    return git("merge-base", "HEAD", ref);
  } catch {
    throw new Error(
      `no merge-base with ${ref}: run \`git fetch origin\` or name another ref in ARCH_BASE_REF`
    );
  }
}

describe("the debt only shrinks", () => {
  it("flags a rule, an entry or a count the base does not hold, and spares a shrink", () => {
    const base = { a: { "x.ts": 2, "y.ts": 1 } };

    expect(grownDebt(base, { a: { "x.ts": 1 } })).toEqual([]);
    expect(grownDebt(base, { a: { "x.ts": 3 } })).toEqual(["a: x.ts grew from 2 to 3"]);
    expect(grownDebt(base, { a: { "z.ts": 1 } })).toEqual(["a: a new entry z.ts"]);
    expect(grownDebt(base, { b: {} })).toEqual(["b: a new debt"]);
  });

  it("flags a debt file the base does not have", () => {
    expect(newDebtFiles(["a.ts"], ["a.ts", "kinds-debt.json", "kind-baseline.json"])).toEqual([
      "kinds-debt.json",
      "kind-baseline.json",
    ]);
    expect(newDebtFiles(["kinds-debt.json"], ["kinds-debt.json"])).toEqual([]);
  });

  it("holds the head to the debt of the merge-base", () => {
    const base = baseCommit();
    const baseFiles = git("ls-tree", "--name-only", base, "./").split("\n");
    if (!baseFiles.includes(GATE_FILE)) return;
    const headFiles = readdirSync(HERE);
    const baseDebt = baseFiles.includes(DEBT_FILE)
      ? parse(git("show", `${base}:./${DEBT_FILE}`))
      : {};
    const headDebt = headFiles.includes(DEBT_FILE)
      ? parse(readFileSync(`${HERE}/${DEBT_FILE}`, "utf8"))
      : {};

    expect([...newDebtFiles(baseFiles, headFiles), ...grownDebt(baseDebt, headDebt)]).toEqual([]);
  });
});
