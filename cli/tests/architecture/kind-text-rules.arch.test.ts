/**
 * The text rules of the kind gate (`kind-text-rules.ts`): what translate, a test, a repository
 * reach and a scope spelling may say. Each is held to the case it names and then to the real
 * tree, with no violation tolerated.
 */
import { describe, expect, it } from "vitest";
import { entries, expectNone, src, textsOf } from "./kind-rule-fixtures.js";
import {
  binaryViolations,
  repositoryViolations,
  scopeViolations,
  sizeViolations,
  translateViolations,
} from "./kind-text-rules.js";
import { declaredCommands, tsFilesUnder } from "./source-graph.js";

describe("translate holds no list of the other hosts' manifest paths", () => {
  const found = (path: string, text: string) => entries(translateViolations({ [path]: text }));

  it("sees a host manifest path written into a translate file", () => {
    expect(
      found("src/contexts/translate/x.ts", 'const P = [".cursor-plugin/plugin.json"];')
    ).toEqual(['src/contexts/translate/x.ts :: ".cursor-plugin/plugin.json"']);
  });

  it("leaves the canonical spelling, a comment and another context alone", () => {
    const text = 'const P = ".claude-plugin/plugin.json";';
    expect(found("src/contexts/translate/domain/canon-format.ts", text)).toEqual([]);
    expect(
      found("src/contexts/translate/x.ts", "// the plugin.json of a host\nconst a = 1;")
    ).toEqual([]);
    expect(found("src/contexts/tools/x.ts", text)).toEqual([]);
  });

  it("holds the translate context of the tree", () => {
    expectNone(translateViolations(src()));
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
