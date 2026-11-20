/**
 * The content rules of the kind gate (`kind-rules.ts`), each held to the case it names and then to
 * the real tree, up to the debt in `kinds-debt.json`. A listed entry that no longer violates
 * fails, so the fix removes it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, contextNames, declaredCommands, tsFilesUnder } from "./helpers.js";
import {
  answerViolations,
  compositionViolations,
  errorViolations,
  instructionViolations,
  isPortFile,
  portViolations,
  repositoryViolations,
  sectionViolations,
  sizeViolations,
  translateViolations,
} from "./kind-rules.js";
import { debtVerdict, loadDebt, type Rule, type Violation } from "./kinds.js";

const entries = (found: readonly Violation[]): string[] => found.map((v) => v.entry);

function expectUpToDebt(found: readonly Violation[], rule: Rule): void {
  const { unlisted, stale } = debtVerdict(found, loadDebt(), [rule]);
  expect(unlisted.map((violation) => violation.message)).toEqual([]);
  expect(stale).toEqual([]);
}

const textsOf = (paths: readonly string[]): Record<string, string> =>
  Object.fromEntries(paths.map((path) => [path, readFileSync(join(CLI_ROOT, path), "utf8")]));

let sources: Record<string, string> | undefined;
const src = (): Record<string, string> =>
  (sources ??= textsOf(tsFilesUnder("src").filter((path) => !path.endsWith(".d.ts"))));

describe("an error class is thrown", () => {
  const catalog = "src/shared/domain/errors.ts";
  const declared = [
    "export class GhostError extends AiddError {}",
    "export class LiveError extends AiddError {}",
    "export class RejectedError extends AiddError {}",
  ].join("\n");
  const found = (thrower: string) =>
    entries(errorViolations({ [catalog]: declared, "src/a.ts": thrower }, [catalog]));

  it("flags a class nothing throws, and a class only a test string mentions", () => {
    expect(found('expect(error.name).toBe("GhostError");')).toEqual([
      `${catalog} :: GhostError`,
      `${catalog} :: LiveError`,
      `${catalog} :: RejectedError`,
    ]);
  });

  it("clears a class thrown, and one handed to reject", () => {
    expect(
      found("function f() { throw new LiveError(); }\nreturn Promise.reject(new RejectedError());")
    ).toEqual([`${catalog} :: GhostError`]);
  });

  it("holds the catalog of the tree", () => {
    const files = src();
    const declaring = [
      "src/shared/domain/errors.ts",
      ...Object.keys(files).filter((path) => path.endsWith(".error.ts")),
    ];
    expect(files[declaring[0] ?? ""], "the catalog moved").toBeDefined();
    expectUpToDebt(errorViolations(files, declaring), "thrown");
  });
});

describe("a message that instructs names a command that exists", () => {
  const declared = new Set(["marketplace", "marketplace add", "plugin", "setup"]);
  const found = (text: string) => entries(instructionViolations({ "src/a.ts": text }, declared));

  it("flags an instruction the CLI cannot honour, a pair included", () => {
    expect(found('const m = "Run `aidd bogus` again";')).toEqual(["src/a.ts: aidd bogus"]);
    expect(found("const m = `Run aidd plugin marketplace add`;")).toEqual([
      "src/a.ts: aidd plugin marketplace",
    ]);
  });

  it("passes a declared command, and reads no comment or bare prose", () => {
    expect(found('const m = "Run `aidd setup` again";')).toEqual([]);
    expect(found("// `aidd bogus` used to exist\nconst x = 1;")).toEqual([]);
  });

  it("holds the surface a person reads", () => {
    const surface = Object.fromEntries(
      Object.entries(src()).filter(
        ([path]) => path.startsWith("src/presentation/") || path.includes("/application/")
      )
    );
    expectUpToDebt(instructionViolations(surface, declaredCommands()), "instructs");
  });
});

describe("composition holds one module per context", () => {
  const found = (files: string[], contexts: string[]) =>
    entries(compositionViolations(files, contexts));

  it("names the module a context lacks and the module no context owns", () => {
    const files = ["container", "shared", "stray", "tools"].map((m) => `src/composition/${m}.ts`);
    expect(found(files, ["tools", "recipes"])).toEqual([
      "missing module: recipes",
      "extra module: stray",
    ]);
  });

  it("names a subfolder that is not orchestration, and ignores files inside one", () => {
    const files = ["container", "shared", "orchestration/setup", "extras/a"].map(
      (m) => `src/composition/${m}.ts`
    );
    expect(found(files, [])).toEqual(["unexpected subfolder: extras"]);
  });

  it("holds the composition folder of the tree", () => {
    expectUpToDebt(compositionViolations(Object.keys(src()), contextNames()), "composition");
  });
});

describe("a port declares nothing nobody calls", () => {
  const port = "src/shared/ports/thing.ts";
  const iface = (lines: string[]) => ["export interface Thing {", ...lines, "}"].join("\n");
  const found = (portText: string, others: Record<string, string> = {}) =>
    entries(portViolations(new Map([[port, portText], ...Object.entries(others)])));

  it("names the method nothing spells as a call, and clears the one a caller spells", () => {
    expect(
      found(iface(["  doIt(x: number): void;", "  gone(): void;"]), {
        "src/composition/caller.ts": "thing.doIt(1);",
      })
    ).toEqual([`${port} :: Thing.gone`]);
  });

  it("does not read an adapter implementing a method as a caller", () => {
    expect(
      found(iface(["  doIt(x: number): void;"]), {
        "src/shared/infrastructure/thing-adapter.ts": "class A { doIt(x: number): void {} }",
      })
    ).toEqual([`${port} :: Thing.doIt`]);
  });

  it("flags an optional method, and ignores a property", () => {
    expect(
      found(iface(["  readonly name: string;", "  maybe?(): void;"]), {
        "src/composition/caller.ts": "thing.maybe();",
      })
    ).toEqual([`${port} :: Thing.maybe`]);
  });

  it("reads a contract folder as ports, and a folder merely ending in ports as none", () => {
    expect(isPortFile("src/contexts/auth/contract/token-provider.ts")).toBe(true);
    expect(isPortFile("src/contexts/auth/ports/identity-verifier.ts")).toBe(true);
    expect(isPortFile("src/presentation/reports/summary.ts")).toBe(false);
  });

  it("holds the ports of the tree, and finds them", () => {
    const files = src();
    expect(Object.keys(files).filter(isPortFile).length, "the scope is stale").toBeGreaterThan(10);
    expectUpToDebt(portViolations(new Map(Object.entries(files))), "ports");
  });
});

describe("a section declares nothing nobody calls", () => {
  const section = "src/contexts/tools/domain/sections/thing-section.ts";
  const thing = [
    "export class ThingSection {",
    "  used(): string {",
    "    return this.helper();",
    "  }",
    "  helper(): string {",
    '    return "x";',
    "  }",
    "  merge(a: string, b: string): string {",
    "    return b;",
    "  }",
    "}",
  ].join("\n");
  const found = (caller: string) =>
    entries(
      sectionViolations(
        new Map([
          [section, thing],
          ["src/contexts/framework/application/caller.ts", caller],
        ])
      )
    );

  it("names the method nobody calls, and clears the ones a section receiver calls", () => {
    expect(found("tool.sections.thing.used();")).toEqual([`${section} :: ThingSection.merge`]);
    expect(found("section.used();\nresolveThingSection(id)?.merge(a, b);")).toEqual([]);
  });

  it("does not read another type's method of the same name as a call to the section's", () => {
    expect(found("cap.used();\nformat.merge(a, b);")).toEqual([`${section} :: ThingSection.merge`]);
  });

  it("holds the sections of the tree, and finds them", () => {
    const files = src();
    expect(
      Object.keys(files).filter((path) => /\/domain\/sections\//.test(path)).length,
      "the scope is stale"
    ).toBeGreaterThan(5);
    expectUpToDebt(sectionViolations(new Map(Object.entries(files))), "sections");
  });
});

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
    expectUpToDebt(translateViolations(src()), "translate");
  });
});

describe("a plugin answer is asked, never read", () => {
  const file = "src/contexts/tools/domain/sections/x-section.ts";
  const found = (text: string) => entries(answerViolations({ [file]: text }));

  it("flags a public field, a parameter property and a getter handing back a stored value", () => {
    expect(found("export class X {\n  outputPath = 1;\n}")).toEqual([`${file} :: X.outputPath`]);
    expect(found("export class X {\n  constructor(readonly path: string) {}\n}")).toEqual([
      `${file} :: X.path`,
    ]);
    expect(found("export class X {\n  get path() { return this.#path; }\n}")).toEqual([
      `${file} :: X.path`,
    ]);
  });

  it("passes a # field behind a method that computes", () => {
    expect(
      found(
        "export class X {\n  #path = 1;\n  path(root: string) { return join(root, this.#path); }\n}"
      )
    ).toEqual([]);
  });

  it("holds the plugin answers of the tree", () => {
    expectUpToDebt(answerViolations(src()), "answers");
  });
});

describe("a test reaches the repository through one helper", () => {
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

  it("clears a climb that stays inside cli/, the helper itself and the gate's own tests", () => {
    expect(found('import { x } from "../../../src/x.js"; join(dir, "..")')).toEqual([]);
    expect(found('join(CLI_ROOT, "..")', "tests/helpers/repository-root.ts")).toEqual([]);
    expect(found('join(CLI_ROOT, "..")', "tests/architecture/x.arch.test.ts")).toEqual([]);
  });

  it("holds the tests of the tree", () => {
    expectUpToDebt(repositoryViolations(textsOf(tsFilesUnder("tests"))), "repository");
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
    expectUpToDebt(sizeViolations(textsOf(paths)), "size");
  });
});
