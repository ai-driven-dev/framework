/**
 * A tolerated list is a debt, and a debt only goes down. The size of each such list is read
 * twice, at the head and at the merge-base with the branch this one merges into, and a list that
 * is longer at the head fails. Nothing is committed beside the list, so a change cannot grow one
 * and raise a number to match: a shrink needs no second edit.
 *
 * A tolerated list is any variable, declared anywhere under `tests/architecture` (subfolders
 * included), whose name holds `BASELINE`, plus the ones named in `OTHER_TOLERATED_LISTS`.
 * `list-sizes.ts` reads them from the syntax tree and sizes a list only when it can see every
 * entry; a tolerated list it cannot size fails. A record counts its properties, an array held
 * under a property counting its leaf entries. Raising a count or a method list inside an entry is
 * held by the test that owns the list, which pins each of them exactly.
 *
 * What the ratchet does not hold:
 * - lists are chosen by naming convention, so a list whose name is unregistered, or one imported
 *   from outside `tests/architecture`, is not held;
 * - class static properties are not read.
 *
 * A list non-empty at the base that is gone at the head fails, since a rename would otherwise
 * restart its count: keep the name, or empty the list first. `RENAMED_LISTS` is the one way out,
 * a rename that carries the old size to the new name. A list the base does not hold is not
 * compared, and one shrunk since the base is held only once the base contains the shrink.
 * A `RENAMED_LISTS` entry is needed only while the base holds the old list and lacks the new
 * one. It is stale, and fails, when the base already holds both (the new name would borrow a
 * list that was there before), when the tree no longer shows the rename, and when another entry
 * names the same target (each would silence a vanished list). Where the base lacks the old list
 * the entry carries nothing and is left alone, so one tree stays valid against `next` and
 * against an integration branch that already took the rename. Nothing reports such an inert
 * entry: a person removes it once `next` has the rename.
 *
 * The base is the merge-base of `HEAD` with `ARCH_BASE_REF`, else with `origin/` and the branch a
 * pull request targets (`GITHUB_BASE_REF`), else with `origin/next`. A stacked branch names its
 * parent branch. Where git cannot give it the check is skipped, except in CI, where a missing
 * base fails.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { CLI_ROOT, REPO_ROOT, read } from "./helpers.js";
import { type ListSizes, listSizes } from "./list-sizes.js";

/** Shrink-only lists whose name does not say so. Register a list here by name, never by content. */
const OTHER_TOLERATED_LISTS: ReadonlySet<string> = new Set([
  "TRANSITIONAL_PAIRS",
  "STORED_ANSWERS_ALLOWED",
  "PROFILE_READERS_ALLOWED",
]);

/**
 * A list renamed since the base, by the id it had there, naming the id that carries its count on.
 * An entry leaves once `next` holds the new name; none joins it to hide a list.
 */
const RENAMED_LISTS: Readonly<Record<string, string>> = {
  "tests/architecture/ports-are-called.arch.test.ts#CAPABILITY_BASELINE":
    "tests/architecture/ports-are-called.arch.test.ts#SECTION_BASELINE",
};

const ARCHITECTURE_DIRECTORY = "tests/architecture";
const CLI_DIRECTORY = "cli";
const ARCHITECTURE_DIRECTORY_IN_REPO = `${CLI_DIRECTORY}/${ARCHITECTURE_DIRECTORY}`;
const DEFAULT_BASE_BRANCH = "next";
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;
const FEWEST_LISTS_THE_TREE_HOLDS = 10;

/** The ref a change is compared with: the one named, else the branch a pull request merges into. */
function baseRef(): string {
  const { ARCH_BASE_REF, GITHUB_BASE_REF } = process.env;
  return ARCH_BASE_REF || `origin/${GITHUB_BASE_REF || DEFAULT_BASE_BRANCH}`;
}

function isToleratedList(name: string): boolean {
  return name.includes("BASELINE") || OTHER_TOLERATED_LISTS.has(name);
}

/** The lists of `files`, each sized or `null` where the reading cannot size it. */
const listsOf = (files: Readonly<Record<string, string>>) => listSizes(files, isToleratedList);

/** The lists the guard can hold, by id. */
function sized(lists: ListSizes): Map<string, number> {
  return new Map(
    [...lists].flatMap(([id, size]): [string, number][] => (size === null ? [] : [[id, size]]))
  );
}

/** The ids of the lists the guard cannot hold. */
function unsized(lists: ListSizes): string[] {
  return [...lists].flatMap(([id, size]) => (size === null ? [id] : []));
}

type Renames = Readonly<Record<string, string>>;

/**
 * A rename that no longer carries its list: the tree does not show it, it borrows a list the base
 * had, or another entry names the same target and so would carry a second list onto it. An old
 * name is a key of the record, so the same source twice is a duplicate key the compiler refuses.
 */
function staleRenames(
  head: ReadonlyMap<string, number>,
  base: ReadonlyMap<string, number>,
  renamed: Renames = RENAMED_LISTS
): string[] {
  const targets = Object.values(renamed);
  return Object.entries(renamed).flatMap(([from, to]) =>
    head.has(from) ||
    !head.has(to) ||
    (base.has(from) && base.has(to)) ||
    targets.indexOf(to) !== targets.lastIndexOf(to)
      ? [`${from} -> ${to} is stale: remove it from RENAMED_LISTS`]
      : []
  );
}

/** What to say about each list that grew or vanished since the base, in the order of the ids. */
function verdicts(
  head: ReadonlyMap<string, number>,
  base: ReadonlyMap<string, number>,
  renamed: Renames = RENAMED_LISTS
): string[] {
  const predecessors = new Map(Object.entries(renamed).map(([from, to]) => [to, from]));
  const grown = [...head.keys()].sort().flatMap((id) => {
    const was = base.get(id) ?? base.get(predecessors.get(id) ?? id);
    const size = head.get(id) ?? 0;
    return was !== undefined && size > was
      ? [`${id} went from ${was} to ${size} entries since the base: a tolerated list only shrinks`]
      : [];
  });
  const vanished = [...base.keys()].sort().flatMap((id) => {
    const held = base.get(id) ?? 0;
    return held > 0 && !head.has(id) && !head.has(renamed[id] ?? id)
      ? [`${id} held ${held} entries at the base and is gone: keep its name, or empty it first`]
      : [];
  });
  return [...grown, ...vanished];
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
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** The lists the architecture files hold at `revision` of the repository at `root`. */
function listsAtRevision(root: string, revision: string): ListSizes {
  const paths = git(root, [
    "ls-tree",
    "-r",
    "--name-only",
    revision,
    `${ARCHITECTURE_DIRECTORY_IN_REPO}/`,
  ])
    .split("\n")
    .filter((path) => path.endsWith(".ts"));
  return listsOf(
    Object.fromEntries(
      paths.map((path) => [
        path.replace(`${CLI_DIRECTORY}/`, ""),
        git(root, ["show", `${revision}:${path}`]),
      ])
    )
  );
}

function listsAtHead(): ListSizes {
  return listsOf(
    Object.fromEntries(
      readdirSync(join(CLI_ROOT, ARCHITECTURE_DIRECTORY), { recursive: true, encoding: "utf8" })
        .map((name) => `${ARCHITECTURE_DIRECTORY}/${name.replaceAll("\\", "/")}`)
        .filter((path) => path.endsWith(".ts"))
        .map((path) => [path, read(path)])
    )
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
  let head: ListSizes;
  beforeAll(() => {
    head = listsAtHead();
  });

  it("reads the lists of the tree, so a rule selecting none cannot pass", () => {
    expect(head.size).toBeGreaterThan(FEWEST_LISTS_THE_TREE_HOLDS);
  });

  it("registers the lists that do not carry BASELINE in their name", () => {
    const ids = [...head.keys()];
    for (const name of OTHER_TOLERATED_LISTS) {
      expect(
        ids.some((id) => id.endsWith(`#${name}`)),
        `${name} is declared by no architecture file`
      ).toBe(true);
    }
  });

  it("sizes every tolerated list an architecture file declares", () => {
    expect(unsized(head), "a list the guard cannot size is a list it cannot hold").toEqual([]);
  });

  it("holds no list longer, or gone, since the merge-base with the branch this one merges into", (context) => {
    const ref = baseRef();
    const base = mergeBase(REPO_ROOT, ref);
    if (base === null) {
      expect(process.env.CI, `no merge-base with ${ref}: fetch its history`).toBeUndefined();
      context.skip();
      return;
    }
    const sizedHead = sized(head);
    const atBase = sized(listsAtRevision(REPO_ROOT, base));
    expect([...verdicts(sizedHead, atBase), ...staleRenames(sizedHead, atBase)]).toEqual([]);
  });
});

describe("the guard itself", () => {
  const list = (body: string) => sized(listsOf({ "a.ts": body }));
  const unsizedLists = (body: string) =>
    unsized(listsOf({ "a.ts": body })).map((id) => id.replace("a.ts#", ""));

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

  it("fails a list that grew, and keeps a shrink and a list the base lacks quiet", () => {
    expect(verdicts(new Map([["a.ts#BASELINE", 3]]), new Map([["a.ts#BASELINE", 2]]))).toEqual([
      "a.ts#BASELINE went from 2 to 3 entries since the base: a tolerated list only shrinks",
    ]);
    expect(verdicts(new Map([["b.ts#NEW_BASELINE", 1]]), new Map())).toEqual([]);
    expect(verdicts(new Map([["a.ts#BASELINE", 1]]), new Map([["a.ts#BASELINE", 2]]))).toEqual([]);
  });

  it("fails a non-empty list that is gone, and lets an emptied one go", () => {
    expect(verdicts(new Map(), new Map([["a.ts#BASELINE", 2]]), {})).toEqual([
      "a.ts#BASELINE held 2 entries at the base and is gone: keep its name, or empty it first",
    ]);
    expect(verdicts(new Map(), new Map([["a.ts#BASELINE", 0]]), {})).toEqual([]);
  });

  it("carries a renamed list's count to its new name, and no further", () => {
    const renamed = { "a.ts#OLD_BASELINE": "a.ts#NEW_BASELINE" };
    const base = new Map([["a.ts#OLD_BASELINE", 2]]);

    expect(verdicts(new Map([["a.ts#NEW_BASELINE", 2]]), base, renamed)).toEqual([]);
    expect(verdicts(new Map([["a.ts#NEW_BASELINE", 3]]), base, renamed)).toEqual([
      "a.ts#NEW_BASELINE went from 2 to 3 entries since the base: a tolerated list only shrinks",
    ]);
  });

  describe("a rename entry", () => {
    const renamed = { "a.ts#OLD_BASELINE": "a.ts#NEW_BASELINE" };
    const sizes = (...ids: string[]) => new Map(ids.map((id) => [id, 2]));
    const OLD = "a.ts#OLD_BASELINE";
    const NEW = "a.ts#NEW_BASELINE";

    it("is kept while the base holds the old list and lacks the new one", () => {
      expect(staleRenames(sizes(NEW), sizes(OLD), renamed)).toEqual([]);
    });

    it("is kept where the base lacks the old list, which an integration branch may", () => {
      expect(staleRenames(sizes(NEW), sizes(NEW), renamed)).toEqual([]);
    });

    it("is stale when the base held both lists, the new name borrowing one that was there", () => {
      expect(staleRenames(sizes(NEW), sizes(OLD, NEW), renamed)).toHaveLength(1);
    });

    it("is stale when the head still declares the old list", () => {
      expect(staleRenames(sizes(OLD, NEW), sizes(OLD), renamed)).toHaveLength(1);
    });

    it("is stale when the head lacks the new list", () => {
      expect(staleRenames(sizes(), sizes(OLD), renamed)).toHaveLength(1);
    });

    it("is stale, both of them, when another entry names the same target", () => {
      const shared = { ...renamed, "a.ts#OTHER_BASELINE": NEW };

      expect(staleRenames(sizes(NEW), sizes(OLD, "a.ts#OTHER_BASELINE"), shared)).toHaveLength(2);
    });
  });

  it("sees a list in the forms the tree declares one", () => {
    expect(list('const A_BASELINE = new Set(["a", "b"]);').get("a.ts#A_BASELINE")).toBe(2);
    expect(
      list('const A_BASELINE = new Map<string, number>([["a", 1], ["b", 2]]);').get(
        "a.ts#A_BASELINE"
      )
    ).toBe(2);
    expect(list("const A_BASELINE = [/['`]/, /x/];").get("a.ts#A_BASELINE")).toBe(2);
  });

  it("leaves a list unsized when a spread hides its entries", () => {
    expect(unsizedLists("const A_BASELINE = [...ROWS];")).toEqual(["A_BASELINE"]);
    expect(unsizedLists("const A_BASELINE = [{ a: 1 }, ...ROWS];")).toEqual(["A_BASELINE"]);
  });

  it("sizes a record value only when it can see into it", () => {
    const record =
      'const A_BASELINE = { "a": "x", "b": 2, "c": { n: 1 }, "d": WHY, "e": ["p", "q"] };';

    expect(list(`${record}\nconst WHY = "y";`).get("a.ts#A_BASELINE")).toBe(6);
    expect(
      unsizedLists('const A_BASELINE = { "a->b": PAIRS };\nconst PAIRS = ["x", "y"];')
    ).toEqual(["A_BASELINE"]);
    expect(unsizedLists('const A_BASELINE = { "a": Object.freeze(["x"]) };')).toEqual([
      "A_BASELINE",
    ]);
    expect(unsizedLists('const A_BASELINE = { "a": compute() };')).toEqual(["A_BASELINE"]);
  });

  it("counts the leaf entries of an array of arrays", () => {
    expect(list("const A_BASELINE = [['a', 'b'], ['c', ['d']]];").get("a.ts#A_BASELINE")).toBe(4);
    expect(unsizedLists("const A_BASELINE = [['a', ...ROWS]];")).toEqual(["A_BASELINE"]);
  });

  it("refuses a list declared with let or var, which a later assignment can replace", () => {
    expect(unsizedLists("let A_BASELINE = ['a'];\nvar B_BASELINE = ['a', 'b'];")).toEqual([
      "A_BASELINE",
      "B_BASELINE",
    ]);
  });

  it.each([
    "BASELINE = []",
    "BASELINE[0] = 'x'",
    "delete BASELINE[0]",
    "BASELINE.push('x')",
    "BASELINE.splice(0, 1)",
    "BASELINE.unshift('x')",
    "BASELINE.add('x')",
    "BASELINE.set('k', 'x')",
    "BASELINE.delete('x')",
    "(BASELINE as string[]).push('x')",
    "BASELINE!.push('x')",
    "((BASELINE)).push('x')",
  ])("refuses a list that is mutated: %s", (statement) => {
    expect(unsizedLists(`const BASELINE = ['a'];\n${statement};`)).toEqual(["BASELINE"]);
  });

  it("leaves a list that is only read, copied or looped over", () => {
    expect(
      list(
        "const BASELINE = ['a'];\nBASELINE.map((x) => x);\nfor (const x of BASELINE) use(x);"
      ).get("a.ts#BASELINE")
    ).toBe(1);
  });

  it("sees a declaration wherever it sits, not only at the start of a line", () => {
    expect(list("/** x */ const A_BASELINE = ['a'];").get("a.ts#A_BASELINE")).toBe(1);
    expect(unsizedLists("/** x */ const A_BASELINE = Array.of('a');")).toEqual(["A_BASELINE"]);
    expect(list('const ALPHA = "aidd",\n  A_BASELINE = ["a", "b"];').get("a.ts#A_BASELINE")).toBe(
      2
    );
    expect(list("function f() { const A_BASELINE = ['a']; }").get("a.ts#A_BASELINE")).toBe(1);
  });

  it("fails a list it cannot tell from another: declared twice, or bound by a destructuring", () => {
    expect(unsizedLists("const A_BASELINE = ['a'];\n{ const A_BASELINE = []; }")).toEqual([
      "A_BASELINE",
    ]);
    expect(unsizedLists("const { A_BASELINE } = rows;")).toEqual(["A_BASELINE"]);
  });

  it("names a declared list it cannot size", () => {
    expect(unsizedLists("const A_BASELINE = compute();\nconst B_BASELINE = [];\n")).toEqual([
      "A_BASELINE",
    ]);
    expect(unsizedLists("const text = 'const A_BASELINE = compute();';")).toEqual([]);
  });

  it("goes red against a real base when a list grew, with no second edit to hide it", () => {
    const root = mkdtempSync(join(tmpdir(), "baseline-only-shrinks-"));
    try {
      const file = join(root, ARCHITECTURE_DIRECTORY_IN_REPO, "x.arch.test.ts");
      const nested = join(root, ARCHITECTURE_DIRECTORY_IN_REPO, "sub", "y.ts");
      mkdirSync(join(root, ARCHITECTURE_DIRECTORY_IN_REPO, "sub"), { recursive: true });
      git(root, ["init", "-q"]);
      git(root, ["config", "user.email", "t@example.com"]);
      git(root, ["config", "user.name", "t"]);
      git(root, ["config", "commit.gpgsign", "false"]);
      writeFileSync(file, 'const BASELINE = ["a", "b"];\n');
      writeFileSync(nested, 'const NESTED_BASELINE = ["c"];\n');
      git(root, ["add", "."]);
      git(root, ["commit", "-q", "-m", "base"]);
      const base = git(root, ["rev-parse", "HEAD"]).trim();
      const atBase = listsAtRevision(root, base);

      const id = "tests/architecture/x.arch.test.ts#BASELINE";
      expect(Object.fromEntries(atBase)).toEqual({
        [id]: 2,
        "tests/architecture/sub/y.ts#NESTED_BASELINE": 1,
      });
      const nestedId = "tests/architecture/sub/y.ts#NESTED_BASELINE";
      expect(verdicts(new Map([[id, 3]]), sized(atBase))).toEqual([
        `${id} went from 2 to 3 entries since the base: a tolerated list only shrinks`,
        `${nestedId} held 1 entries at the base and is gone: keep its name, or empty it first`,
      ]);
      expect(
        verdicts(
          new Map([
            [id, 2],
            [nestedId, 3],
          ]),
          sized(atBase)
        )
      ).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
