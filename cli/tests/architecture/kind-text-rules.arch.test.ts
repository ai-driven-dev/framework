/**
 * The text rules of the kind gate (`kind-text-rules.ts`): what a manifest path, a test, a repository
 * reach and a scope spelling may say. Each is held to the case it names and then to the real
 * tree, with no violation tolerated.
 */
import { describe, expect, it } from "vitest";
import { entries, expectNone, src, textsOf } from "./kind-rule-fixtures.js";
import {
  binaryViolations,
  domainAssetViolations,
  manifestSpellingViolations,
  purityViolations,
  repositoryViolations,
  scopeViolations,
  sizeViolations,
} from "./kind-text-rules.js";
import { declaredCommands, tsFilesUnder } from "./source-graph.js";

describe("a host's plugin manifest path is spelled once, by the canon or by its profile", () => {
  const found = (path: string, text: string) =>
    entries(manifestSpellingViolations({ [path]: text }));

  it("sees a host manifest path written into a translate file", () => {
    expect(
      found("src/contexts/translate/x.ts", 'const P = [".cursor-plugin/plugin.json"];')
    ).toEqual(['src/contexts/translate/x.ts :: ".cursor-plugin/plugin.json"']);
  });

  it("sees a host plugin directory written into a file of another context", () => {
    expect(
      found("src/contexts/distribution/x.ts", 'const C = ".claude-plugin/marketplace.json";')
    ).toEqual(['src/contexts/distribution/x.ts :: ".claude-plugin/marketplace.json"']);
  });

  it("leaves the canonical spelling, a profile, a comment and a test alone", () => {
    const text = 'const P = ".claude-plugin/plugin.json";';
    expect(found("src/shared/domain/plugin/canon-paths.ts", text)).toEqual([]);
    expect(found("src/composition/tool-profiles/claude.ts", text)).toEqual([]);
    expect(
      found("src/contexts/translate/x.ts", "// the plugin.json of a host\nconst a = 1;")
    ).toEqual([]);
    expect(found("tests/contexts/translate/x.unit.test.ts", text)).toEqual([]);
  });

  it("holds the sources of the tree", () => {
    expectNone(manifestSpellingViolations(src()));
  });
});

describe("a test reaches the repository through the repository-root builder", () => {
  const file = "tests/contexts/a/b.unit.test.ts";
  const found = (text: string, path = file) => entries(repositoryViolations({ [path]: text }));

  it("reports a literal climbing past the package, a cwd parent and the package root's parent", () => {
    expect(
      found(
        [
          'readFileSync(new URL("../../../../plugins/p/README.md", import.meta.url));',
          'resolve(process.cwd(), "..", "plugins");',
          'join(CLI_ROOT, "..")',
        ].join("\n")
      )
    ).toEqual([
      `${file} :: "../../../../plugins/p/README.md"`,
      `${file} :: process.cwd(), ".."`,
      `${file} :: join(CLI_ROOT, ".."`,
    ]);
  });

  it("clears a climb that stays inside cli/, the builder itself and the gate's own tests", () => {
    expect(found('import { x } from "../../../src/x.js"; join(dir, "..")')).toEqual([]);
    expect(
      found('join(CLI_ROOT, "..")', "tests/shared/testing/repository-root.builder.ts")
    ).toEqual([]);
    expect(found('join(CLI_ROOT, "..")', "tests/architecture/x.arch.test.ts")).toEqual([]);
  });

  it("holds the tests of the tree", () => {
    expectNone(repositoryViolations(textsOf(tsFilesUnder("tests"))));
  });
});

describe("a test file stays small enough to hold in mind", () => {
  it("counts 801 lines as over and 800 as not", () => {
    expect(
      entries(
        sizeViolations({
          "tests/over.unit.test.ts": "x\n".repeat(801),
          "tests/at.unit.test.ts": "x\n".repeat(800),
          "tests/fixtures/big.test.ts": "x\n".repeat(900),
        })
      )
    ).toEqual(["tests/over.unit.test.ts"]);
  });

  it("holds the tests of the tree", () => {
    const paths = tsFilesUnder("tests").filter((path) => path.endsWith(".test.ts"));
    expect(paths.length, "the scope is stale").toBeGreaterThan(300);
    expectNone(sizeViolations(textsOf(paths)));
  });
});

describe("the project-or-user union has one spelling", () => {
  const union = ['"project"', '"user"'];
  const found = (text: string) => entries(scopeViolations({ "src/a.ts": text }));

  it("matches the union in either order and clears a lone literal", () => {
    expect(found(`let a: ${union.join(" | ")};`)).toEqual(["src/a.ts"]);
    expect(found(`let a: ${union.reverse().join("|")} | undefined;`)).toEqual(["src/a.ts"]);
    expect(found('const a = "project";')).toEqual([]);
  });

  it("exempts the scope module and the credential level", () => {
    const text = 'type T = "project" | "user";';
    expect(
      entries(
        scopeViolations({
          "src/shared/domain/scope.ts": text,
          "src/contexts/auth/contract/credential.ts": text,
        })
      )
    ).toEqual([]);
  });

  it("holds the tree", () => {
    const files = textsOf(
      [...tsFilesUnder("src"), ...tsFilesUnder("tests")].filter(
        (path) => !path.startsWith("tests/architecture/")
      )
    );
    expectNone(scopeViolations(files));
  });
});

describe("only presentation names the binary", () => {
  const found = (text: string, path = "src/contexts/a/application/b.ts") =>
    entries(binaryViolations({ [path]: text }, new Set(["sync", "setup"])));

  it("reports a string and a template naming a command, backticked or not", () => {
    expect(found('const m = "Run `aidd sync` again";')).toEqual([
      'src/contexts/a/application/b.ts :: "Run `aidd sync` again"',
    ]);
    expect(found("const m = `Rerun aidd sync --force to restore it`;")).toHaveLength(1);
    expect(found('const m = "run aidd <command>";')).toHaveLength(1);
    expect(found('const m = "aidd setup";')).toHaveLength(1);
  });

  it("clears presentation, a comment and a word that only starts with the name", () => {
    expect(found('const m = "Run `aidd sync`";', "src/presentation/errors/x.ts")).toEqual([]);
    expect(found("// `aidd sync` runs this\nconst x = 1;")).toEqual([]);
    expect(found('const m = "aidd-framework and aidd\'s own key";')).toEqual([]);
    expect(found('const m = "not an aidd command";')).toEqual([]);
  });
});

describe("the tree below presentation names no binary", () => {
  it("holds the tree", () => {
    expectNone(binaryViolations(src(), declaredCommands()));
  });
});

describe("the domain holds no clock, no logging and no memo", () => {
  const model = "src/contexts/a/domain/b.model.ts";
  const found = (text: string, path = model) => entries(purityViolations({ [path]: text }));

  it.each([
    ["Date.now", "export const f = () => Date.now();", "Date.now()"],
    ["a bare new Date", "export const f = () => new Date();", "new Date()"],
    ["performance.now", "export const f = () => performance.now();", "performance.now()"],
    ["process.hrtime", "export const f = () => process.hrtime();", "process.hrtime()"],
    ["console", "export const f = () => console.warn('x');", "console.warn()"],
    [
      "a module-level let",
      "let cache = 0;\nexport const f = () => cache;",
      "module-level let cache",
    ],
    [
      "a Map a function writes",
      "const seen = new Map<string, number>();\nexport const f = (k: string) => seen.set(k, 1);",
      "module-level Map seen written",
    ],
    [
      "a Set a function writes",
      "const seen = new Set<string>();\nexport const f = (k: string) => seen.add(k);",
      "module-level Set seen written",
    ],
  ])("reports %s", (_name, text, what) => {
    expect(found(text)).toEqual([`${model} :: ${what}`]);
  });

  it("clears a dated value, a read-only table, a generated script and a layer that may keep state", () => {
    expect(found("export const f = (t: number) => new Date(t);")).toEqual([]);
    expect(found("const T = new Set(['a']);\nexport const f = (k: string) => T.has(k);")).toEqual(
      []
    );
    expect(found("export const s = `console.warn(Date.now())`;")).toEqual([]);
    expect(found("// Date.now() console.log\nexport const a = 1;")).toEqual([]);
    expect(
      found("export const f = () => Date.now();", "src/contexts/a/infrastructure/b.adapter.ts")
    ).toEqual([]);
    expect(found("let n = 0;", "src/contexts/a/application/b.use-case.ts")).toEqual([]);
  });

  it("holds the domain of the tree", () => {
    expectNone(purityViolations(src()));
  });
});

describe("a domain imports no raw asset", () => {
  it("sees a script imported by a domain and leaves composition alone", () => {
    const text = 'import adapter from "../../../assets/hooks-runtime/host-bridge.cjs";';
    expect(
      domainAssetViolations({
        "src/contexts/tools/domain/x.ts": text,
        "src/composition/tool-profiles/kilo.ts": text,
      }).map((v) => v.entry)
    ).toEqual(["src/contexts/tools/domain/x.ts :: ../../../assets/hooks-runtime/host-bridge.cjs"]);
  });

  it("holds the tree", () => {
    expectNone(domainAssetViolations(src()));
  });
});
