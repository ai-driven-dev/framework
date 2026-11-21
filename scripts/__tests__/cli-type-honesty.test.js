const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const GUARD = path.resolve(__dirname, "..", "check-cli-type-honesty.mjs");

/**
 * The guard reads process.cwd(), so every case is a whole miniature package under a temp
 * directory. Both cli/src and cli/tests must exist: a missing one throws ENOENT, which exits
 * non-zero with no breach and would pass an exit-code-only assertion for the wrong reason.
 */
const ALLOWED_CAST_FILE = "cli/src/contexts/translate/application/build-native-tree.ts";
const A_CAST = "const parsed = raw as unknown as SourceMarketplace;";

function plant(dir, files) {
  for (const [relative, contents] of Object.entries(files)) {
    const full = path.join(dir, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, `${contents}\n`);
  }
}

const TSCONFIG = JSON.stringify({ include: ["src/**/*", "tests/**/*"] });

/** Every fixture counts its one tolerated cast (`as unknown as` is two assertions), so a case only moves the counts it plants. */
const ALLOWED_CAST_BASELINE = { "src/contexts/translate/application/build-native-tree.ts": 2 };

/** A hook runs with GIT_DIR and GIT_INDEX_FILE set: left in, a fixture's git would act on the repository being committed. */
const withoutGitEnv = () =>
  Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));

const git = (dir, ...args) =>
  spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd: dir,
    encoding: "utf8",
    env: withoutGitEnv(),
  });

/**
 * The tree is a git repository whose one commit is the base, holding `baseBaseline`
 * (`null`: the base has no baseline file); the files planted after it are the change, staged.
 * `moved` is `{ from, to, source }`: `source` is in the base at `from`, and the change `git mv`s it to `to` (cli-relative paths).
 */
function runOn(files, baseline = ALLOWED_CAST_BASELINE, baseBaseline = baseline, moved = null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-type-honesty-"));
  try {
    git(dir, "init", "-q");
    plant(dir, {
      "cli/tsconfig.json": TSCONFIG,
      ...(moved ? { [`cli/${moved.from}`]: moved.source } : {}),
      ...(baseBaseline === null
        ? { "cli/.keep": "" }
        : { "cli/type-assertions-baseline.json": JSON.stringify(baseBaseline) }),
    });
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "base");
    if (moved) {
      fs.mkdirSync(path.dirname(path.join(dir, "cli", moved.to)), { recursive: true });
      git(dir, "mv", `cli/${moved.from}`, `cli/${moved.to}`);
    }
    plant(dir, {
      [ALLOWED_CAST_FILE]: A_CAST,
      "cli/tests/.keep.ts": "export const kept = 1;",
      "cli/type-assertions-baseline.json": JSON.stringify(baseline),
      ...files,
    });
    git(dir, "add", "-A");
    const result = spawnSync(process.execPath, [GUARD], {
      cwd: dir,
      encoding: "utf8",
      env: { ...withoutGitEnv(), ARCH_BASE_REF: "HEAD" },
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("a tree whose only cast is the one CASTS_ALLOWED excuses passes", () => {
  const clean = runOn({ "cli/src/honest.ts": "export const one: number = 1;" });

  assert.equal(clean.status, 0, clean.output);
  assert.match(clean.output, /No type is widened/);
});

test("a value widened through unknown in src is named and fails", () => {
  const breach = runOn({ "cli/src/widened.ts": "export const x = raw as unknown as Thing;" });

  assert.equal(breach.status, 1);
  assert.match(breach.output, /cli\/src\/widened\.ts widens a type/);
});

test("a compiler directive in src is named, and the same directive in tests is not", () => {
  const inSource = runOn({ "cli/src/silenced.ts": "// @ts-expect-error deliberate\nexport const x = 1;" });
  const inTests = runOn({ "cli/tests/silenced.ts": "// @ts-expect-error proves it does not compile\nexport const x = 1;" });

  assert.equal(inSource.status, 1);
  assert.match(inSource.output, /cli\/src\/silenced\.ts widens a type/);
  assert.equal(inTests.status, 0, inTests.output);
});

test("an allowance nobody spends is named, so a fixed cast drops its entry", () => {
  const stale = runOn({ [ALLOWED_CAST_FILE]: "export const parsed: SourceMarketplace = build();" });

  assert.equal(stale.status, 1);
  assert.match(stale.output, /build-native-tree\.ts no longer casts - drop its CASTS_ALLOWED entry/);
});

const MINTS_A_TOOL_ID = [
  "const id = raw as ToolId;",
  "const ids = raw as readonly ToolId[];",
  "const ids = raw as Array<AiToolId>;",
  "const id = raw as typeof TOOL.claude;",
  "const id = <IdeToolId>raw;",
  "const isId = (x: ToolId): x is ToolId => true;",
  "function assertId(x: string): asserts x is ToolId {}",
  "const isAi = (x: unknown): x is AiToolId => true;",
  "const isIde = (a: Thing, b: string): b is IdeToolId => true;",
  "const id = raw as\n  ToolId;",
];

test("every spelling that turns text into a tool id is named, in src and in tests alike", () => {
  const planted = Object.fromEntries(
    MINTS_A_TOOL_ID.map((line, i) => [`cli/${i % 2 ? "tests" : "src"}/mint${i}.ts`, line])
  );
  const breach = runOn(planted);
  assert.equal(breach.status, 1);
  for (const file of Object.keys(planted)) assert.ok(breach.output.includes(`${file} `), file);
});

test("the profile definition and the catalog's own declarations may name a tool id", () => {
  const legal = runOn(
    {
      "cli/src/contexts/tools/domain/profile/define-tool.ts": "const id = raw as AiToolId;",
      "cli/src/contexts/tools/contract/tool-catalog.ts": "isAiTool(id: ToolId): id is AiToolId;",
      "cli/src/contexts/tools/application/registered-tool-catalog.ts": "isIdeTool(id: ToolId): id is IdeToolId;",
    },
    { ...ALLOWED_CAST_BASELINE, "src/contexts/tools/domain/profile/define-tool.ts": 1 }
  );
  assert.equal(legal.status, 0, legal.output);
});

test("a renaming import or export is no cast, and a real cast after one still is", () => {
  const renamed = runOn({
    "cli/src/honest.ts": 'import {\n  a as b,\n  type ToolId,\n} from "./x.js";\nexport { b as ToolId };',
  });
  const castAfter = runOn({
    "cli/src/widened.ts": 'import { a as b, type ToolId } from "./x.js";\nexport const id = raw as ToolId;',
  });
  assert.equal(renamed.status, 0, renamed.output);
  assert.equal(castAfter.status, 1);
  assert.match(castAfter.output, /cli\/src\/widened\.ts casts text/);
});

test("a type assertion above its file's baseline is named by file and line, in src and in tests", () => {
  const breach = runOn({
    "cli/src/widened.ts": "export const a = 1;\nexport const x = [] as string[];",
    "cli/tests/silenced.ts": "export const y = <string[]>[];",
  });

  assert.equal(breach.status, 1);
  assert.match(breach.output, /cli\/src\/widened\.ts has 1 type assertions, baseline 0: cli\/src\/widened\.ts:2/);
  assert.match(breach.output, /cli\/tests\/silenced\.ts:1/);
});

test("a file that keeps its baseline passes, and one that shrinks below it is asked to lower it", () => {
  const held = runOn({ "cli/src/honest.ts": "export const x = [] as string[];" }, {
    ...ALLOWED_CAST_BASELINE,
    "src/honest.ts": 1,
  });
  const shrunk = runOn({ "cli/src/honest.ts": "export const x: string[] = [];" }, {
    ...ALLOWED_CAST_BASELINE,
    "src/honest.ts": 1,
  });

  assert.equal(held.status, 0, held.output);
  assert.equal(shrunk.status, 1);
  assert.match(shrunk.output, /cli\/src\/honest\.ts has 0 type assertions, baseline 1: lower it in cli\/type-assertions-baseline\.json/);
});

test("as const and satisfies assert nothing and are not counted", () => {
  const clean = runOn({
    "cli/src/honest.ts": 'export const a = ["x"] as const;\nexport const b = { k: 1 } satisfies Record<string, number>;',
  });

  assert.equal(clean.status, 0, clean.output);
});

/** The annotation must resolve: an unresolved name is the checker's error type, which reads as `any`. */
const THING = "interface Thing {\n  a: string;\n}\n";

const DISGUISED_CASTS = {
  "json-parse": `${THING}export const x: Thing = JSON.parse(raw);`,
  "require": `${THING}export const x: Thing = require("./thing");`,
  "any-binding": `${THING}declare const a: any;\nexport const x: Thing = a;`,
  "multi-line-type": "export const x: {\n  a: string;\n} = JSON.parse(raw);",
};

for (const [name, source] of Object.entries(DISGUISED_CASTS)) {
  test(`an annotated binding whose initializer is untyped counts as a cast: ${name}`, () => {
    const breach = runOn({ [file("disguised")]: source });

    assert.equal(breach.status, 1, breach.output);
    assert.match(breach.output, /disguised\.ts has 1 type assertions, baseline 0: .*disguised\.ts:\d/);
  });
}

test("a binding that annotates unknown or any, or holds a typed value, or already casts, adds no extra count", () => {
  const clean = runOn({
    "cli/src/honest.ts": [
      "export const a: unknown = JSON.parse(raw);",
      "export const b: any = JSON.parse(raw);",
      "export const c: number = 1;",
      "export const d = JSON.parse(raw);",
    ].join("\n"),
  });
  const once = runOn({ [file("cast")]: `${THING}export const x: Thing = <any>JSON.parse(raw);` }, {
    ...ALLOWED_CAST_BASELINE,
    "src/cast.ts": 1,
  });

  assert.equal(clean.status, 0, clean.output);
  assert.equal(once.status, 0, once.output);
});

test("a cast and a raised baseline in one change fail against the base's baseline", () => {
  const raised = { ...ALLOWED_CAST_BASELINE, "src/honest.ts": 1 };
  const breach = runOn({ "cli/src/honest.ts": "export const x = [] as string[];" }, raised, ALLOWED_CAST_BASELINE);

  assert.equal(breach.status, 1);
  assert.match(breach.output, /cli\/type-assertions-baseline\.json totals 3 at the head and 2 at the base/);
});

test("a baseline raised on a file the base already counts fails, and a lowered one passes", () => {
  const atBase = { ...ALLOWED_CAST_BASELINE, "src/honest.ts": 2 };
  const raised = runOn(
    { "cli/src/honest.ts": "export const x = [[]] as string[][] as string[][];" },
    { ...ALLOWED_CAST_BASELINE, "src/honest.ts": 3 },
    atBase
  );
  const lowered = runOn({ "cli/src/honest.ts": "export const x = [] as string[];" }, { ...ALLOWED_CAST_BASELINE, "src/honest.ts": 1 }, atBase);

  assert.equal(raised.status, 1);
  assert.match(raised.output, /src\/honest\.ts holds 3 at the head and 2 at the base/);
  assert.equal(lowered.status, 0, lowered.output);
});

test("a change that adds the baseline file is not compared with a base that lacks it", () => {
  const added = runOn({}, ALLOWED_CAST_BASELINE, null);

  assert.equal(added.status, 0, added.output);
});

test("a base git cannot give fails, since a ratchet that skips is not one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-type-honesty-"));
  try {
    plant(dir, {
      "cli/tsconfig.json": TSCONFIG,
      [ALLOWED_CAST_FILE]: A_CAST,
      "cli/tests/.keep.ts": "export const kept = 1;",
      "cli/type-assertions-baseline.json": "{}",
    });
    const result = spawnSync(process.execPath, [GUARD], { cwd: dir, encoding: "utf8", env: withoutGitEnv() });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no merge-base with/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** Fixture paths are built, so no comment-scanner mistakes one for a file this repository should hold. */
const file = (name) => `cli/src/${name}.ts`;

const SPLIT_BASE = { ...ALLOWED_CAST_BASELINE, "src/sink.ts": 5 };

test("a split that moves counts to a new file passes while the total does not rise", () => {
  const sunk = "export const x = [] as string[];\nexport const y = [] as string[];\nexport const z = [] as string[];";
  const writer = "export const a = [] as string[];\nexport const b = [] as string[];";
  const files = { [file("sink")]: sunk, [file("writer")]: writer };
  const level = runOn(files, { ...ALLOWED_CAST_BASELINE, "src/sink.ts": 3, "src/writer.ts": 2 }, SPLIT_BASE);

  assert.equal(level.status, 0, level.output);
});

test("a renamed file keeps the count it had, so a rise after the move fails by name", () => {
  const moved = { from: "src/old.ts", to: "src/new.ts", source: "export const x = [] as string[];" };
  const base = { ...ALLOWED_CAST_BASELINE, "src/old.ts": 1 };
  const kept = runOn({ [file("new")]: "export const x = [] as string[];" }, { ...ALLOWED_CAST_BASELINE, "src/new.ts": 1 }, base, moved);
  const raised = runOn(
    { [file("new")]: "export const x = [] as string[];\nexport const y = [] as string[];", [file("other")]: "export const k = 1;" },
    { ...ALLOWED_CAST_BASELINE, "src/new.ts": 2, "src/other.ts": 0 },
    { ...base, "src/other.ts": 1 },
    moved
  );

  assert.equal(kept.status, 0, kept.output);
  assert.equal(raised.status, 1);
  assert.match(raised.output, /cli\/src\/new\.ts holds 2 at the head and 1 at the base/);
});

test("a base without the baseline fails unless the change adds the file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aidd-type-honesty-"));
  try {
    git(dir, "init", "-q");
    plant(dir, { "cli/tsconfig.json": TSCONFIG, "cli/.keep": "" });
    git(dir, "add", "-A");
    git(dir, "commit", "-q", "-m", "base");
    plant(dir, { [ALLOWED_CAST_FILE]: A_CAST, "cli/tests/.keep.ts": "export const kept = 1;" });
    git(dir, "add", "-A");
    const result = spawnSync(process.execPath, [GUARD], {
      cwd: dir,
      encoding: "utf8",
      env: { ...withoutGitEnv(), ARCH_BASE_REF: "HEAD" },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /the base has no cli\/type-assertions-baseline\.json and this change does not add it/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
