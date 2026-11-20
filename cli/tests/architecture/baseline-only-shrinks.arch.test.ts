/**
 * A tolerated list is a debt, and a debt only goes down. The size of each such list is read
 * twice, at the head and at the merge-base with the branch this one merges into, and a list that
 * is longer at the head fails. Nothing is committed beside the list, so a change cannot grow one
 * and raise a number to match: a shrink needs no second edit.
 *
 * A tolerated list is any variable, declared anywhere under `tests/architecture` (subfolders
 * included), whose name holds `BASELINE`, plus the ones named in `OTHER_TOLERATED_LISTS`.
 * `list-sizes.ts` reads them from the syntax tree; its docblock holds the sizing rules and what it
 * refuses, and a tolerated list it cannot size fails. Raising a count or a method list inside an
 * entry is held by the test that owns the list, which pins each of them exactly.
 *
 * What the ratchet does not hold:
 * - mutation of a list after its declaration, by any path: review owns it, and the readonly type
 *   is shallow, as `list-sizes.ts` says along with what it does not read;
 * - lists are chosen by naming convention, so a list whose name is unregistered, or one imported
 *   from outside `tests/architecture`, is not held.
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
 * parent branch. Where git cannot give it, the check fails: a ratchet that skips is not one.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CLI_ROOT, REPO_ROOT } from "./helpers.js";
import {
  ARCHITECTURE_DIRECTORY,
  filesOnDisk,
  isToleratedList,
  type ListSizes,
  listSizes,
  listWeights,
  OTHER_TOLERATED_LISTS,
} from "./list-sizes.js";

/**
 * A list renamed since the base, by the id it had there, naming the id that carries its count on.
 * An entry leaves once `next` holds the new name; none joins it to hide a list.
 */
const RENAMED_LISTS: Readonly<Record<string, string>> = {
  "tests/architecture/ports-are-called.arch.test.ts#CAPABILITY_BASELINE":
    "tests/architecture/ports-are-called.arch.test.ts#SECTION_BASELINE",
};

/**
 * A list whose rule was retired on purpose, by its id at the base. The list is not renamed, it is
 * gone with its test; each entry leaves once `next` holds the retirement. This test goes with the
 * last of them, replaced by a ratchet on the one debt file.
 */
const RETIRED_LISTS: ReadonlySet<string> = new Set([
  "tests/architecture/folder-size.arch.test.ts#BASELINE",
  "tests/architecture/command-shape.arch.test.ts#COMMAND_SHAPE_BASELINE",
  "tests/architecture/command-shape.arch.test.ts#HELPERS_BY_DESIGN",
  "tests/architecture/orchestrator-deps.arch.test.ts#BASELINE",
  "tests/architecture/domain-does-no-io.arch.test.ts#BASELINE",
  "tests/architecture/test-mirror-path.arch.test.ts#MIRROR_BASELINE",
]);

const CLI_DIRECTORY = "cli";
const ARCHITECTURE_DIRECTORY_IN_REPO = `${CLI_DIRECTORY}/${ARCHITECTURE_DIRECTORY}`;
const DEFAULT_BASE_BRANCH = "next";
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;
const FEWEST_LISTS_THE_TREE_HOLDS = 10;

/** The ref a change is compared with: the one named, else the branch a pull request merges into. */
function baseRef(env: NodeJS.ProcessEnv = process.env): string {
  const { ARCH_BASE_REF, GITHUB_BASE_REF } = env;
  return ARCH_BASE_REF || `origin/${GITHUB_BASE_REF || DEFAULT_BASE_BRANCH}`;
}

/** The lists of `files`, each sized or `null` where the reading cannot size it. */
const listsOf = (files: Readonly<Record<string, string>>) =>
  listSizes(files, isToleratedList, { requireReadonly: true });

/** The numbers the lists of `files` record. */
const weighed = (files: Readonly<Record<string, string>>) =>
  listWeights(files, isToleratedList, { requireReadonly: false });

/** The lists of a base revision. */
const listsOfBase = (files: Readonly<Record<string, string>>) =>
  listSizes(files, isToleratedList, { requireReadonly: false });

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

/** The list an entry id belongs to: `<file>#<list>`, the entry key following. */
const listOfEntry = (id: string): string => id.split("#").slice(0, 2).join("#");

/** The entries whose recorded number rose since the base, a rename carrying the old list's. */
function numberVerdicts(
  head: ReadonlyMap<string, number>,
  base: ReadonlyMap<string, number>,
  renamed: Renames = RENAMED_LISTS
): string[] {
  const predecessors = new Map(Object.entries(renamed).map(([from, to]) => [to, from]));
  return [...head.keys()].sort().flatMap((id) => {
    const list = listOfEntry(id);
    const before = base.get(`${predecessors.get(list) ?? list}${id.slice(list.length)}`);
    const now = head.get(id) ?? 0;
    return before !== undefined && now > before
      ? [`${id} recorded ${before} at the base and records ${now}: a recorded count only goes down`]
      : [];
  });
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
    return held > 0 && !RETIRED_LISTS.has(id) && !head.has(id) && !head.has(renamed[id] ?? id)
      ? [`${id} held ${held} entries at the base and is gone: keep its name, or empty it first`]
      : [];
  });
  return [...grown, ...vanished];
}

/**
 * The problems of `head` against the lists of the base. A missing base fails, in CI and outside
 * it, and so does a base list that cannot be sized.
 */
function compareWithBase(
  head: ListSizes,
  base: ListSizes | null,
  ref: string,
  renamed: Renames = RENAMED_LISTS
): string[] {
  if (base === null)
    return [
      `no merge-base with ${ref}: run \`git fetch origin\` or name another ref in ARCH_BASE_REF`,
    ];
  const unsizedAtBase = unsized(base).map(
    (id) => `${id} is held at the base and the guard cannot size it`
  );
  if (unsizedAtBase.length > 0) return unsizedAtBase;
  const sizedHead = sized(head);
  const sizedBase = sized(base);
  return [
    ...verdicts(sizedHead, sizedBase, renamed),
    ...staleRenames(sizedHead, sizedBase, renamed),
  ];
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

/** The architecture sources at `revision` of the repository at `root`, by path under `cli`. */
function filesAtRevision(root: string, revision: string): Record<string, string> {
  const paths = git(root, [
    "ls-tree",
    "-r",
    "--name-only",
    revision,
    `${ARCHITECTURE_DIRECTORY_IN_REPO}/`,
  ])
    .split("\n")
    .filter((path) => path.endsWith(".ts"));
  return Object.fromEntries(
    paths.map((path) => [
      path.replace(`${CLI_DIRECTORY}/`, ""),
      git(root, ["show", `${revision}:${path}`]),
    ])
  );
}

/** The lists the architecture files hold at `revision` of the repository at `root`. */
const listsAtRevision = (root: string, revision: string): ListSizes =>
  listsOfBase(filesAtRevision(root, revision));

/** The lists the architecture files hold in the working tree of the `cli` directory at `cliRoot`. */
const listsOnDisk = (cliRoot: string): ListSizes => listsOf(filesOnDisk(cliRoot));

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
    head = listsOnDisk(CLI_ROOT);
  });

  it("reads the lists of the tree, so a rule selecting none cannot pass", () => {
    expect(head.size).toBeGreaterThanOrEqual(FEWEST_LISTS_THE_TREE_HOLDS);
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

  it("holds no list longer, or gone, since the merge-base with the branch this one merges into", () => {
    const ref = baseRef();
    const base = mergeBase(REPO_ROOT, ref);
    const problems = compareWithBase(
      head,
      base === null ? null : listsAtRevision(REPO_ROOT, base),
      ref
    );
    expect(problems).toEqual([]);
  });

  it("records no number that rose since the merge-base", () => {
    const base = mergeBase(REPO_ROOT, baseRef());
    if (base === null) throw new Error(`no merge-base with ${baseRef()}`);

    expect(
      numberVerdicts(
        sized(weighed(filesOnDisk(CLI_ROOT))),
        sized(weighed(filesAtRevision(REPO_ROOT, base)))
      )
    ).toEqual([]);
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
      list(
        "const X_BASELINE: readonly unknown[] = [{ path: 'a', n: 1, tags: [1, 2] }, { path: 'b', n: 2 }];"
      ).get("a.ts#X_BASELINE")
    ).toBe(2);
    expect(
      list(
        'const BASELINE: Readonly<Record<string, { count: number }>> = { "a": { count: 1 }, "b": { count: 2 } };'
      ).get("a.ts#BASELINE")
    ).toBe(2);
    expect(list("const BASELINE: readonly string[] = [];").get("a.ts#BASELINE")).toBe(0);
  });

  it("counts the pairs of a record of arrays, and the entries of a record of strings", () => {
    expect(
      list(
        'const TRANSITIONAL_PAIRS: Readonly<Record<string, unknown>> = { "a->b": ["x", "y"], "c->d": ["z"] };'
      ).get("a.ts#TRANSITIONAL_PAIRS")
    ).toBe(3);
    expect(
      list(
        'const STORED_ANSWERS_ALLOWED: Readonly<Record<string, unknown>> = { "k1": "why, one", "k2": "why two" };'
      ).get("a.ts#STORED_ANSWERS_ALLOWED")
    ).toBe(2);
  });

  it("holds a list that grew over a base list whatever its type was", () => {
    const grown = sized(listsOf({ "a.ts": "const A_BASELINE: readonly string[] = ['a', 'b'];" }));
    for (const declaration of [
      "const A_BASELINE: string[] = ['a'];",
      "let A_BASELINE = ['a'];",
      "const A_BASELINE = ['a'];",
    ]) {
      expect(verdicts(grown, sized(listsOfBase({ "a.ts": declaration }))), declaration).toEqual([
        "a.ts#A_BASELINE went from 1 to 2 entries since the base: a tolerated list only shrinks",
      ]);
    }
  });

  it("leaves a base list without an initializer unsized, so the guard says so", () => {
    expect(unsized(listsOfBase({ "a.ts": "let A_BASELINE;" }))).toEqual(["a.ts#A_BASELINE"]);
  });

  it("leaves a base list unsized when its literal cannot be read, so the guard says so", () => {
    expect(unsized(listsOfBase({ "a.ts": "const A_BASELINE = [...ROWS];" }))).toEqual([
      "a.ts#A_BASELINE",
    ]);
  });

  it("reads the ref to compare with from ARCH_BASE_REF, else GITHUB_BASE_REF, else next", () => {
    expect(baseRef({ ARCH_BASE_REF: "parent", GITHUB_BASE_REF: "main" })).toBe("parent");
    expect(baseRef({ GITHUB_BASE_REF: "main" })).toBe("origin/main");
    expect(baseRef({})).toBe("origin/next");
    expect(baseRef({ GITHUB_BASE_REF: "" })).toBe("origin/next");
    expect(baseRef({ ARCH_BASE_REF: "", GITHUB_BASE_REF: "main" })).toBe("origin/main");
  });

  describe("a base git does not give", () => {
    const head: ListSizes = new Map([["a.ts#A_BASELINE", 1]]);

    it("fails, in CI or not", () => {
      expect(compareWithBase(head, null, "origin/next")).toEqual([
        "no merge-base with origin/next: run `git fetch origin` or name another ref in ARCH_BASE_REF",
      ]);
    });
  });

  describe("the numbers a list records", () => {
    const weights = (body: string) => sized(weighed({ "a.ts": body }));
    const LIST = "a.ts#A_BASELINE";

    it("reads one number per entry, by its record key or its path, file or edge field", () => {
      expect(
        Object.fromEntries(
          weights("const A_BASELINE: Readonly<Record<string, number>> = { x: 996, 'y.ts': 4 };")
        )
      ).toEqual({ [`${LIST}#x`]: 996, [`${LIST}#y.ts`]: 4 });
      expect(
        Object.fromEntries(
          weights(
            "const A_BASELINE: readonly unknown[] = [{ path: 'p', n: 2, m: 1 }, { file: 'f', n: 3 }, { edge: 'e', n: 4 }, { path: 'none' }];"
          )
        )
      ).toEqual({ [`${LIST}#p`]: 3, [`${LIST}#f`]: 3, [`${LIST}#e`]: 4 });
      expect(weights("const A_BASELINE: readonly string[] = ['a'];").size).toBe(0);
    });

    it("leaves a list unreadable when a numbered entry has no key", () => {
      expect(
        unsized(weighed({ "a.ts": "const A_BASELINE: readonly unknown[] = [{ n: 2 }];" }))
      ).toEqual([LIST]);
    });

    const before = new Map([
      [`${LIST}#a`, 850],
      [`${LIST}#b`, 820],
    ]);

    it("fails an entry whose number rose while another fell, so a swap is not absorbed", () => {
      const swapped = new Map([
        [`${LIST}#a`, 900],
        [`${LIST}#b`, 770],
      ]);

      expect(numberVerdicts(swapped, before, {})).toEqual([
        `${LIST}#a recorded 850 at the base and records 900: a recorded count only goes down`,
      ]);
    });

    it("keeps a fall, a left entry, a new entry and a list the base lacks quiet", () => {
      expect(numberVerdicts(new Map([[`${LIST}#a`, 800]]), before, {})).toEqual([]);
      expect(numberVerdicts(new Map([["b.ts#B_BASELINE#x", 9]]), before, {})).toEqual([]);
      expect(numberVerdicts(new Map([[`${LIST}#c`, 1]]), before, {})).toEqual([]);
    });

    it("carries a renamed list's entries to its new name", () => {
      const renamed = { [LIST]: "a.ts#NEW_BASELINE" };

      expect(numberVerdicts(new Map([["a.ts#NEW_BASELINE#a", 851]]), before, renamed)).toHaveLength(
        1
      );
      expect(numberVerdicts(new Map([["a.ts#NEW_BASELINE#a", 850]]), before, renamed)).toEqual([]);
    });
  });

  it("fails a base list it cannot size instead of dropping it", () => {
    const head: ListSizes = new Map([["a.ts#A_BASELINE", 1]]);
    const base: ListSizes = new Map([
      ["a.ts#A_BASELINE", null],
      ["b.ts#B_BASELINE", 1],
    ]);

    expect(compareWithBase(head, base, "origin/next")).toEqual([
      "a.ts#A_BASELINE is held at the base and the guard cannot size it",
    ]);
  });

  describe("a rename between the base and the head", () => {
    const renamed = { "a.ts#OLD_BASELINE": "a.ts#NEW_BASELINE" };

    it("is stale when the head still holds the old list", () => {
      const head: ListSizes = new Map([
        ["a.ts#OLD_BASELINE", 2],
        ["a.ts#NEW_BASELINE", 2],
      ]);
      const base: ListSizes = new Map([["a.ts#OLD_BASELINE", 2]]);

      expect(compareWithBase(head, base, "x", renamed)).toEqual([
        "a.ts#OLD_BASELINE -> a.ts#NEW_BASELINE is stale: remove it from RENAMED_LISTS",
      ]);
    });

    it("carries the old size to the new name, so growth is held", () => {
      const head: ListSizes = new Map([["a.ts#NEW_BASELINE", 3]]);
      const base: ListSizes = new Map([["a.ts#OLD_BASELINE", 2]]);

      expect(compareWithBase(head, base, "x", renamed)).toEqual([
        "a.ts#NEW_BASELINE went from 2 to 3 entries since the base: a tolerated list only shrinks",
      ]);
    });
  });

  it("compares the sized lists of the head with the base", () => {
    const base: ListSizes = new Map([["a.ts#A_BASELINE", 1]]);

    expect(compareWithBase(new Map([["a.ts#A_BASELINE", 2]]), base, "x", {})).toEqual([
      "a.ts#A_BASELINE went from 1 to 2 entries since the base: a tolerated list only shrinks",
    ]);
    expect(compareWithBase(new Map([["a.ts#A_BASELINE", 1]]), base, "x", {})).toEqual([]);
  });

  it("hands git no GIT_* variable of the process it runs in", () => {
    expect(plainEnvironment({ GIT_DIR: "elsewhere", GIT_INDEX_FILE: "x", PATH: "p" })).toEqual({
      PATH: "p",
    });
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

  it("refuses a collection, which no tolerated list of the tree is", () => {
    for (const declaration of [
      "const A_BASELINE: ReadonlySet<string> = new Set(['a']);",
      "const A_BASELINE: ReadonlyMap<string, number> = new Map([['a', 1]]);",
      "const A_BASELINE: readonly string[] = new Foo(['a']);",
    ]) {
      expect(unsizedLists(declaration), declaration).toEqual(["A_BASELINE"]);
    }
  });

  it("leaves a list unsized when a spread hides its entries", () => {
    expect(unsizedLists("const A_BASELINE: readonly unknown[] = [...ROWS];")).toEqual([
      "A_BASELINE",
    ]);
    expect(unsizedLists("const A_BASELINE: readonly unknown[] = [{ a: 1 }, ...ROWS];")).toEqual([
      "A_BASELINE",
    ]);
  });

  it("sizes a record value only when it can see into it", () => {
    const record =
      'const A_BASELINE: Readonly<Record<string, unknown>> = { "a": "x", "b": 2, "c": { n: 1 }, "d": WHY, "e": ["p", "q"] };';

    expect(list(`${record}\nconst WHY = "y";`).get("a.ts#A_BASELINE")).toBe(6);
    expect(
      unsizedLists(
        'const A_BASELINE: Readonly<Record<string, unknown>> = { "a->b": PAIRS };\nconst PAIRS = ["x", "y"];'
      )
    ).toEqual(["A_BASELINE"]);
    expect(
      unsizedLists(
        'const A_BASELINE: Readonly<Record<string, unknown>> = { "a": Object.freeze(["x"]) };'
      )
    ).toEqual(["A_BASELINE"]);
    expect(
      unsizedLists('const A_BASELINE: Readonly<Record<string, unknown>> = { "a": compute() };')
    ).toEqual(["A_BASELINE"]);
  });

  it.each([
    "const A_BASELINE: Readonly<Record<string, unknown>> = { a: 'x', ...ROWS };",
    "const A_BASELINE: Readonly<Record<string, unknown>> = { a: 'x', method() {} };",
  ])("refuses a record property that is a spread or a method: %s", (declaration) => {
    expect(unsizedLists(declaration)).toEqual(["A_BASELINE"]);
  });

  it("counts the leaf entries of an array of arrays", () => {
    expect(
      list("const A_BASELINE: readonly unknown[] = [['a', 'b'], ['c', ['d']]];").get(
        "a.ts#A_BASELINE"
      )
    ).toBe(4);
    expect(unsizedLists("const A_BASELINE: readonly unknown[] = [['a', ...ROWS]];")).toEqual([
      "A_BASELINE",
    ]);
  });

  it("refuses a list declared with let or var, which a later assignment can replace", () => {
    expect(
      unsizedLists(
        "let A_BASELINE: readonly string[] = ['a'];\nvar B_BASELINE: readonly string[] = ['a', 'b'];"
      )
    ).toEqual(["A_BASELINE", "B_BASELINE"]);
  });

  it.each([
    "const A_BASELINE: string[] = ['a'];",
    "const A_BASELINE = ['a'];",
    "const A_BASELINE: Record<string, string> = { a: 'x' };",
    "const A_BASELINE: Array<string> = ['a'];",
    "const A_BASELINE: keyof Rows = ['a'];",
    "const A_BASELINE = ['a'] as const;",
    "const A_BASELINE = ['a'] as Array<string>;",
  ])("refuses a list whose type is not readonly: %s", (declaration) => {
    expect(unsizedLists(declaration)).toEqual(["A_BASELINE"]);
  });

  it.each([
    "const A_BASELINE: readonly string[] = ['a'];",
    "const A_BASELINE: ReadonlyArray<string> = ['a'];",
    "const A_BASELINE: Readonly<Record<string, string>> = { a: 'x' };",
  ])("holds a list whose type is readonly: %s", (declaration) => {
    expect(list(declaration).get("a.ts#A_BASELINE")).toBe(1);
  });

  it("sees a declaration wherever it sits, not only at the start of a line", () => {
    expect(
      list("/** x */ const A_BASELINE: readonly unknown[] = ['a'];").get("a.ts#A_BASELINE")
    ).toBe(1);
    expect(unsizedLists("/** x */ const A_BASELINE: readonly unknown[] = Array.of('a');")).toEqual([
      "A_BASELINE",
    ]);
    expect(
      list('const ALPHA = "aidd",\n  A_BASELINE: readonly string[] = ["a", "b"];').get(
        "a.ts#A_BASELINE"
      )
    ).toBe(2);
    expect(
      list("function f() { const A_BASELINE: readonly unknown[] = ['a']; }").get("a.ts#A_BASELINE")
    ).toBe(1);
  });

  it("fails a list it cannot tell from another, and does not read a destructured name", () => {
    expect(
      unsizedLists(
        "const A_BASELINE: readonly unknown[] = ['a'];\n{ const A_BASELINE: readonly unknown[] = []; }"
      )
    ).toEqual(["A_BASELINE"]);
    expect(list("const { A_BASELINE } = rows;").size).toBe(0);
  });

  it("names a declared list it cannot size", () => {
    expect(
      unsizedLists(
        "const A_BASELINE: readonly unknown[] = compute();\nconst B_BASELINE: readonly unknown[] = [];\n"
      )
    ).toEqual(["A_BASELINE"]);
  });

  it("reads the lists of every subfolder of the working tree", () => {
    const root = mkdtempSync(join(tmpdir(), "baseline-only-shrinks-"));
    try {
      const folder = join(root, ARCHITECTURE_DIRECTORY, "sub");
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "y.ts"), 'const NESTED_BASELINE: readonly unknown[] = ["c"];\n');

      expect(Object.fromEntries(listsOnDisk(root))).toEqual({
        "tests/architecture/sub/y.ts#NESTED_BASELINE": 1,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("names the file the compiler returned no source for", () => {
    expect(() => listsOf({ "notes.txt": "const A_BASELINE: readonly unknown[] = ['a'];" })).toThrow(
      "the compiler returned no source for notes.txt"
    );
  });

  it("goes red against a real base when a list grew, with no second edit to hide it", () => {
    const root = mkdtempSync(join(tmpdir(), "baseline-only-shrinks-"));
    const elsewhere = join(root, "the-git-dir-of-the-process");
    try {
      const file = join(root, ARCHITECTURE_DIRECTORY_IN_REPO, "x.arch.test.ts");
      const nested = join(root, ARCHITECTURE_DIRECTORY_IN_REPO, "sub", "y.ts");
      mkdirSync(join(root, ARCHITECTURE_DIRECTORY_IN_REPO, "sub"), { recursive: true });
      vi.stubEnv("GIT_DIR", elsewhere);
      git(root, ["init", "-q"]);
      git(root, ["config", "user.email", "t@example.com"]);
      git(root, ["config", "user.name", "t"]);
      git(root, ["config", "commit.gpgsign", "false"]);
      writeFileSync(file, 'const BASELINE: readonly unknown[] = ["a", "b"];\n');
      writeFileSync(join(root, ARCHITECTURE_DIRECTORY_IN_REPO, "notes.md"), "not a source file\n");
      writeFileSync(nested, 'const NESTED_BASELINE: readonly unknown[] = ["c"];\n');
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
      expect(existsSync(elsewhere), "git acted on the GIT_DIR of the process").toBe(false);
    } finally {
      vi.unstubAllEnvs();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
