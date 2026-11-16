/**
 * A tolerated list is a debt, and a debt only goes down. The size of each such list is read
 * twice, at the head and at the merge-base with `next`, and a list that is longer at the head
 * fails. Nothing is committed beside the list, so a change cannot grow one and raise a number to
 * match: a shrink needs no second edit. A list the base does not hold is not compared, since
 * the migration creates lists that next has never seen; a new list is read at review.
 *
 * A tolerated list is any declared `const` whose name holds `BASELINE`, plus the ones named in
 * `OTHER_TOLERATED_LISTS`. Only the top-level entries are counted, a record of arrays counting
 * the entries of its arrays. Raising a count or a method list inside an entry is held by the
 * test that owns the list, which pins each of them exactly.
 *
 * The base is the merge-base of `HEAD` and `origin/next` (`ARCH_BASE_REF` names another ref).
 * Where git cannot give it the check is skipped, except in CI, where a missing base fails.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, REPO_ROOT, read } from "./helpers.js";
import { closingBracket, codeOnly, topLevelPieces } from "./source-shapes.js";

/** Shrink-only lists whose name does not say so. Register a list here by name, never by content. */
const OTHER_TOLERATED_LISTS: ReadonlySet<string> = new Set([
  "TRANSITIONAL_PAIRS",
  "STORED_ANSWERS_ALLOWED",
]);

const ARCHITECTURE_DIRECTORY = "cli/tests/architecture";
const BASE_REF = process.env.ARCH_BASE_REF ?? "origin/next";

function isToleratedList(name: string): boolean {
  return name.includes("BASELINE") || OTHER_TOLERATED_LISTS.has(name);
}

/** What a piece counts for: the entries of an array held under a key, otherwise itself. */
function entriesOf(piece: string): number {
  const keyed = /^(?:"[^"]*"|\w+)\s*:\s*\[/.exec(piece);
  if (!keyed) return 1;
  const open = keyed[0].length - 1;
  return topLevelPieces(piece.slice(open + 1, closingBracket(piece, open))).length;
}

/** Entries of each tolerated list declared as `const <name> ... = [` or `= {` in `text`. */
function declaredListSizes(file: string, text: string): Map<string, number> {
  const code = codeOnly(text);
  const sizes = new Map<string, number>();
  for (const declaration of code.matchAll(/\bconst (\w+)\b/g)) {
    const name = declaration[1] as string;
    if (!isToleratedList(name)) continue;
    const afterName = declaration.index + declaration[0].length;
    const assignment = /=(?!>)\s*([[{])/.exec(code.slice(afterName));
    if (!assignment) continue;
    const open = afterName + assignment.index + assignment[0].length - 1;
    const pieces = topLevelPieces(code.slice(open + 1, closingBracket(code, open)));
    sizes.set(
      `${file}#${name}`,
      pieces.reduce((total, piece) => total + entriesOf(piece), 0)
    );
  }
  return sizes;
}

/** What to say about each list the base holds that is longer at the head, in the order of the ids. */
function verdicts(head: ReadonlyMap<string, number>, base: ReadonlyMap<string, number>): string[] {
  return [...head.keys()].sort().flatMap((id) => {
    const size = head.get(id) ?? 0;
    const was = base.get(id);
    return was !== undefined && size > was
      ? [`${id} went from ${was} to ${size} entries since the base: a tolerated list only shrinks`]
      : [];
  });
}

/** The environment of a child that must not act on this repository through inherited `GIT_*`. */
function plainEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_"))
  );
}

function git(root: string, args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    env: plainEnvironment(),
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** The sizes of the lists the architecture files hold at `revision` of the repository at `root`. */
function listsAtRevision(root: string, revision: string): Map<string, number> {
  const files = git(root, ["ls-tree", "--name-only", revision, `${ARCHITECTURE_DIRECTORY}/`])
    .split("\n")
    .filter((path) => path.endsWith(".ts"));
  return new Map(
    files.flatMap((path) => [
      ...declaredListSizes(path.replace(/^cli\//, ""), git(root, ["show", `${revision}:${path}`])),
    ])
  );
}

function listsAtHead(): Map<string, number> {
  const directory = join(CLI_ROOT, "tests", "architecture");
  return new Map(
    readdirSync(directory)
      .filter((name) => name.endsWith(".ts"))
      .flatMap((name) => [
        ...declaredListSizes(`tests/architecture/${name}`, read(`tests/architecture/${name}`)),
      ])
  );
}

function mergeBase(root: string, ref: string): string | null {
  try {
    return git(root, ["merge-base", "HEAD", ref]).trim();
  } catch {
    return null;
  }
}

describe("tolerated lists only shrink", () => {
  it("reads the lists of the tree, so a rule selecting none cannot pass", () => {
    expect(listsAtHead().size).toBeGreaterThan(10);
  });

  it("registers the lists that do not carry BASELINE in their name", () => {
    const ids = [...listsAtHead().keys()];
    for (const name of OTHER_TOLERATED_LISTS) {
      expect(
        ids.some((id) => id.endsWith(`#${name}`)),
        `${name} is declared by no architecture file`
      ).toBe(true);
    }
  });

  it("holds no list longer than at the merge-base with next", (context) => {
    const base = mergeBase(REPO_ROOT, BASE_REF);
    if (base === null) {
      expect(process.env.CI, `no merge-base with ${BASE_REF}: fetch its history`).toBeUndefined();
      context.skip();
      return;
    }
    expect(verdicts(listsAtHead(), listsAtRevision(REPO_ROOT, base))).toEqual([]);
  });
});

describe("the guard itself", () => {
  const list = (body: string) => declaredListSizes("a.ts", body);

  it("counts the entries of a list of strings, of objects and of a record", () => {
    expect(list('const BASELINE: readonly string[] = ["a", "b", "c"];').get("a.ts#BASELINE")).toBe(
      3
    );
    expect(
      list("const X_BASELINE = [{ path: 'a', n: 1, tags: [1, 2] }, { path: 'b', n: 2 }];").get(
        "a.ts#X_BASELINE"
      )
    ).toBe(2);
    expect(
      list(
        'const BASELINE: Readonly<Record<string, { count: number }>> = { "a": { count: 1 }, "b": { count: 2 } };'
      ).get("a.ts#BASELINE")
    ).toBe(2);
    expect(list("const BASELINE: string[] = [];").get("a.ts#BASELINE")).toBe(0);
  });

  it("counts the pairs of a record of arrays, and the entries of a record of strings", () => {
    expect(
      list('const TRANSITIONAL_PAIRS = { "a->b": ["x", "y"], "c->d": ["z"] };').get(
        "a.ts#TRANSITIONAL_PAIRS"
      )
    ).toBe(3);
    expect(
      list('const STORED_ANSWERS_ALLOWED = { "k1": "why, one", "k2": "why two" };').get(
        "a.ts#STORED_ANSWERS_ALLOWED"
      )
    ).toBe(2);
  });

  it("ignores a list the guard was not told about", () => {
    expect(list('const OTHER = ["a"];').size).toBe(0);
  });

  it("reads a comma or a bracket inside a comment or a string as nothing", () => {
    expect(
      list('const BASELINE = [\n  // a, b, c\n  "x, y]",\n  "z", // [\n];').get("a.ts#BASELINE")
    ).toBe(2);
  });

  it("fails a list that grew, and keeps a shrink and a list the base lacks quiet", () => {
    expect(verdicts(new Map([["a.ts#BASELINE", 3]]), new Map([["a.ts#BASELINE", 2]]))).toEqual([
      "a.ts#BASELINE went from 2 to 3 entries since the base: a tolerated list only shrinks",
    ]);
    expect(verdicts(new Map([["b.ts#NEW_BASELINE", 1]]), new Map())).toEqual([]);
    expect(verdicts(new Map([["a.ts#BASELINE", 1]]), new Map([["a.ts#BASELINE", 2]]))).toEqual([]);
  });

  it("goes red against a real base when a list grew, with no second edit to hide it", () => {
    const root = mkdtempSync(join(tmpdir(), "baseline-only-shrinks-"));
    try {
      const file = join(root, ARCHITECTURE_DIRECTORY, "x.arch.test.ts");
      mkdirSync(join(root, ARCHITECTURE_DIRECTORY), { recursive: true });
      git(root, ["init", "-q"]);
      git(root, ["config", "user.email", "t@example.com"]);
      git(root, ["config", "user.name", "t"]);
      git(root, ["config", "commit.gpgsign", "false"]);
      writeFileSync(file, 'const BASELINE = ["a", "b"];\n');
      git(root, ["add", "."]);
      git(root, ["commit", "-q", "-m", "base"]);
      const base = git(root, ["rev-parse", "HEAD"]).trim();
      const atBase = listsAtRevision(root, base);

      expect([...atBase]).toEqual([["tests/architecture/x.arch.test.ts#BASELINE", 2]]);
      expect(
        verdicts(
          declaredListSizes(
            "tests/architecture/x.arch.test.ts",
            'const BASELINE = ["a", "b", "c"];'
          ),
          atBase
        )
      ).toHaveLength(1);
      expect(
        verdicts(
          declaredListSizes("tests/architecture/x.arch.test.ts", 'const BASELINE = ["a"];'),
          atBase
        )
      ).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
