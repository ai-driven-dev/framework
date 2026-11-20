/**
 * The file-kind gate. `kinds.ts` is the table; this file holds the tree to it and holds each rule
 * to the case it names. Debt is `kinds-debt.json`: every violation the tree has today, and it
 * only shrinks. A listed entry that no longer violates fails, so the fix removes it.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import {
  isArrowFunction,
  isClassDeclaration,
  isClassExpression,
  isExportDeclaration,
  isFunctionDeclaration,
  isFunctionExpression,
  isImportDeclaration,
  isInterfaceDeclaration,
  isTypeAliasDeclaration,
} from "typescript/unstable/ast";
import { describe, expect, it } from "vitest";
import { present } from "../shared/testing/present.js";
import { ALLOWED } from "./allowed-edges.js";
import { CLI_ROOT, canonicalPath, matchesGlob } from "./helpers.js";
import {
  classificationViolations,
  debtVerdict,
  importViolations,
  isInCatalog,
  isUseCase,
  KINDS,
  type Kind,
  kindsOf,
  loadDebt,
  mirrorViolations,
  noDebt,
  type Shape,
  shapeViolations,
  strayViolations,
  type Violation,
} from "./kinds.js";
import { walk, withVirtualProject } from "./ts-project.js";
import { useCaseShapeBreaks } from "./use-case-shape.js";

const CODE_FILE = /\.(?:ts|mts|cts|js|mjs|cjs)$/;

function codeFilesUnder(dir: string): string[] {
  return readdirSync(join(CLI_ROOT, dir), { recursive: true, encoding: "utf8" })
    .map((entry) => canonicalPath(join(dir, entry)))
    .filter((path) => CODE_FILE.test(path))
    .sort();
}

/** What a module declares, read through the compiler. A type-only module holds no runtime; a
 * module has behaviour when it declares a function, an arrow or a class anywhere. */
function shapesOf(files: Readonly<Record<string, string>>): Map<string, Shape> {
  if (Object.keys(files).length === 0) return new Map();
  return withVirtualProject(
    "kind-shapes",
    files,
    { module: "esnext", target: "esnext" },
    (project, at) => {
      const shapes = new Map<string, Shape>();
      for (const path of Object.keys(files)) {
        const source = project.program.getSourceFile(at(path));
        if (!source) throw new Error(`the compiler returned no source for ${path}`);
        const typeOnly = source.statements.every(
          (statement) =>
            isImportDeclaration(statement) ||
            isInterfaceDeclaration(statement) ||
            isTypeAliasDeclaration(statement) ||
            (isExportDeclaration(statement) && statement.isTypeOnly)
        );
        let behaviour = false;
        walk(source, (node) => {
          behaviour ||=
            isFunctionDeclaration(node) ||
            isArrowFunction(node) ||
            isFunctionExpression(node) ||
            isClassDeclaration(node) ||
            isClassExpression(node);
        });
        shapes.set(path, { typeOnly, behaviour });
      }
      return shapes;
    }
  );
}

function violationsOf(path: string, kinds: readonly Kind[] = KINDS): Violation[] {
  return classificationViolations([path], kinds);
}

function importsOf(files: Record<string, string>): string[] {
  return importViolations(files).map((violation) => violation.entry);
}

describe("every file is exactly one kind", () => {
  it.each([
    ["src/contexts/auth/application/log-in.use-case.ts", "use-case"],
    ["src/contexts/auth/application/log-in.ts", "use-case"],
    ["src/orchestration/setup/setup.use-case.ts", "use-case"],
    ["src/contexts/auth/domain/credential.model.ts", "model"],
    ["src/contexts/auth/domain/credential.ts", "model"],
    ["src/contexts/auth/contract/auth-status.ts", "model"],
    ["src/contexts/auth/contract/token-provider.port.ts", "port"],
    ["src/contexts/auth/ports/identity-verifier.ts", "port"],
    ["src/shared/ports/file-reader.port.ts", "port"],
    ["src/contexts/auth/infrastructure/credential-file.adapter.ts", "adapter"],
    ["src/presentation/terminal/prompter.ts", "adapter"],
    ["src/contexts/tools/domain/profiles/claude/claude.profile.ts", "profile"],
    ["src/contexts/tools/domain/profiles/claude/profile.ts", "profile"],
    ["src/contexts/auth/domain/auth.error.ts", "error"],
    ["src/presentation/presentation.error.ts", "error"],
    ["src/presentation/presenters/auth.presenter.ts", "presenter"],
    ["src/presentation/display/auth-display.ts", "presenter"],
    ["src/presentation/controllers/auth.controller.ts", "controller"],
    ["src/presentation/commands/auth.ts", "controller"],
    ["src/composition/auth.composition.ts", "composition"],
    ["src/composition/orchestration/clean.ts", "composition"],
    ["tests/contexts/auth/application/log-in.unit.test.ts", "test"],
    ["tests/e2e/clean.e2e.test.ts", "test"],
    ["tests/contexts/auth/testing/auth.builder.ts", "builder"],
    ["tests/contexts/auth/testing/credentials.fake.ts", "fake"],
    ["tests/contexts/auth/testing/credentials.contract.ts", "contract-suite"],
  ])("%s is a %s", (path, kind) => {
    expect(kindsOf(path)).toEqual([kind]);
    expect(violationsOf(path)).toEqual([]);
  });

  it("flags a file no kind claims, naming the file, the rule and the fix", () => {
    const [violation] = violationsOf("src/presentation/exit.ts");
    expect(violation?.entry).toBe("src/presentation/exit.ts");
    expect(violation?.rule).toBe("classification");
    expect(violation?.message).toContain("src/presentation/exit.ts");
    expect(violation?.message).toMatch(/matches no kind/);
    expect(violation?.message).toMatch(/Fix:/);
  });

  it("flags a test helper that carries no kind suffix", () => {
    expect(violationsOf("tests/helpers/git-sandbox.ts")).toHaveLength(1);
  });

  it("flags a kind suffix outside the folders of its kind", () => {
    const [violation] = violationsOf("src/contexts/auth/application/credential.model.ts");
    expect(violation?.message).toMatch(/model.*outside/);
  });

  it("flags a file two kinds claim", () => {
    const both: Kind[] = [
      { ...present(KINDS.find((kind) => kind.id === "model")), fallback: ["src/a/**/*"] },
      { ...present(KINDS.find((kind) => kind.id === "port")), fallback: ["src/a/**/*"] },
    ];
    const [violation] = violationsOf("src/a/x.ts", both);
    expect(violation?.message).toMatch(/matches 2 kinds: model, port/);
  });

  it("leaves out the entry point, a declaration file, test data and the gate's own support", () => {
    for (const path of [
      "src/cli.ts",
      "src/contexts/x/infrastructure/text-assets.d.ts",
      "tests/fixtures/framework/x.ts",
      "tests/architecture/helpers.ts",
    ]) {
      expect(isInCatalog(path), path).toBe(false);
    }
  });

  it("flags a file of src that is neither source nor a glossary, such as a sed backup", () => {
    expect(
      strayViolations(["src/a.ts", "src/b.md", "src/a.ts-E", "tests/c.json"]).map((v) => v.entry)
    ).toEqual(["src/a.ts-E"]);
  });

  it("holds every file of the tree, up to the debt", () => {
    const everyFile = readdirSync(join(CLI_ROOT, "src"), { recursive: true, encoding: "utf8" })
      .filter((entry) => statSync(join(CLI_ROOT, "src", entry)).isFile())
      .map((entry) => canonicalPath(join("src", entry)));
    expect(strayViolations(everyFile).map((violation) => violation.message)).toEqual([]);
    const paths = [...codeFilesUnder("src"), ...codeFilesUnder("tests")].filter(isInCatalog);
    expect(paths.length, "the scope is stale").toBeGreaterThan(500);
    const { unlisted, stale } = debtVerdict(classificationViolations(paths), loadDebt(), [
      "classification",
    ]);
    expect(unlisted.map((violation) => violation.message)).toEqual([]);
    expect(stale).toEqual([]);
  });
});

describe("a file imports only the kinds its kind allows", () => {
  it("flags a model that imports a use case", () => {
    expect(
      importsOf({
        "src/contexts/a/domain/x.model.ts": 'import { Y } from "../application/y.use-case.js";',
        "src/contexts/a/application/y.use-case.ts": "export class Y {}",
      })
    ).toEqual(["src/contexts/a/domain/x.model.ts -> src/contexts/a/application/y.use-case.ts"]);
  });

  it("reads an unsuffixed file by its folder", () => {
    expect(
      importsOf({
        "src/contexts/a/domain/x.ts": 'import { Y } from "../ports/y.js";',
        "src/contexts/a/ports/y.ts": "export interface Y {}",
      })
    ).toEqual(["src/contexts/a/domain/x.ts -> src/contexts/a/ports/y.ts"]);
  });

  it("names the file, the rule and the fix", () => {
    const [violation] = importViolations({
      "src/contexts/a/domain/x.model.ts": 'import { Y } from "../application/y.use-case.js";',
      "src/contexts/a/application/y.use-case.ts": "export class Y {}",
    });
    expect(violation?.rule).toBe("imports");
    expect(violation?.message).toContain("src/contexts/a/domain/x.model.ts");
    expect(violation?.message).toMatch(/model may not import a use-case/);
    expect(violation?.message).toMatch(/Fix:/);
  });

  it("passes a use case that imports a port, a model and an error", () => {
    expect(
      importsOf({
        "src/contexts/a/application/x.use-case.ts":
          'import type { P } from "../ports/p.port.js";\nimport { M } from "../domain/m.model.js";\nimport { E } from "../domain/a.error.js";',
        "src/contexts/a/ports/p.port.ts": "export interface P {}",
        "src/contexts/a/domain/m.model.ts": "export const M = 1;",
        "src/contexts/a/domain/a.error.ts": "export class E {}",
      })
    ).toEqual([]);
  });

  it("flags a node builtin a model may not use, and passes node:path", () => {
    const files = (builtin: string) => ({
      "src/contexts/a/domain/x.model.ts": `import { f } from "${builtin}";`,
    });
    expect(importsOf(files("node:fs"))).toEqual(["src/contexts/a/domain/x.model.ts -> node:fs"]);
    expect(importsOf(files("node:path"))).toEqual([]);
  });

  it("flags a package a port may not use", () => {
    expect(importsOf({ "src/contexts/a/ports/p.port.ts": 'import x from "smol-toml";' })).toEqual([
      "src/contexts/a/ports/p.port.ts -> smol-toml",
    ]);
  });

  it("lets an adapter use any builtin", () => {
    expect(
      importsOf({
        "src/contexts/a/infrastructure/x.adapter.ts":
          'import { readFile } from "node:fs/promises";',
      })
    ).toEqual([]);
  });

  it("flags a context that reaches into another context past its contract", () => {
    expect(
      importsOf({
        "src/contexts/translate/application/x.use-case.ts":
          'import { M } from "../../tools/domain/m.model.js";',
        "src/contexts/tools/domain/m.model.ts": "export const M = 1;",
      })
    ).toEqual([
      "src/contexts/translate/application/x.use-case.ts -> src/contexts/tools/domain/m.model.ts",
    ]);
  });

  it("flags an edge the context map does not admit, even through a contract", () => {
    expect(
      importsOf({
        "src/contexts/tools/application/x.use-case.ts":
          'import { M } from "../../translate/contract/m.model.js";',
        "src/contexts/translate/contract/m.model.ts": "export const M = 1;",
      })
    ).toEqual([
      "src/contexts/tools/application/x.use-case.ts -> src/contexts/translate/contract/m.model.ts",
    ]);
  });

  it("flags a context that reaches presentation, and shared that reaches a context", () => {
    expect(
      importsOf({
        "src/contexts/tools/application/x.use-case.ts":
          'import { P } from "../../../presentation/p.presenter.js";',
        "src/presentation/p.presenter.ts": "export const P = 1;",
        "src/shared/domain/s.model.ts":
          'import { M } from "../../contexts/tools/contract/m.model.js";',
        "src/contexts/tools/contract/m.model.ts": "export const M = 1;",
      })
    ).toEqual([
      "src/contexts/tools/application/x.use-case.ts -> src/presentation/p.presenter.ts",
      "src/shared/domain/s.model.ts -> src/contexts/tools/contract/m.model.ts",
    ]);
  });

  it("lets presentation reach a context and every layer reach shared", () => {
    expect(
      importsOf({
        "src/presentation/p.presenter.ts":
          'import { M } from "../contexts/tools/contract/m.model.js";',
        "src/contexts/tools/contract/m.model.ts":
          'import { S } from "../../../shared/domain/s.model.js";',
        "src/shared/domain/s.model.ts": "export const S = 1;",
      })
    ).toEqual([]);
  });

  it("holds the context map to a graph without a cycle", () => {
    const reaches = (from: string, seen = new Set<string>()): Set<string> => {
      for (const edge of ALLOWED) {
        const [source = "", target = ""] = edge.split("->");
        if (source === from && !seen.has(target)) reaches(target, seen.add(target));
      }
      return seen;
    };
    const cyclic = [...ALLOWED].filter((edge) => {
      const [source = "", target = ""] = edge.split("->");
      return reaches(target).has(source);
    });
    expect(cyclic, "a context map edge that closes a cycle").toEqual([]);
  });

  it("passes a context that reaches into another through its contract", () => {
    expect(
      importsOf({
        "src/contexts/translate/application/x.use-case.ts":
          'import { M } from "../../tools/contract/m.model.js";',
        "src/contexts/tools/contract/m.model.ts": "export const M = 1;",
      })
    ).toEqual([]);
  });

  it("flags a profile that imports outside tools and shared", () => {
    expect(
      importsOf({
        "src/contexts/tools/domain/profiles/x/x.profile.ts":
          'import { M } from "../../../../installation/domain/m.model.js";',
        "src/contexts/installation/domain/m.model.ts": "export const M = 1;",
      })
    ).toEqual([
      "src/contexts/tools/domain/profiles/x/x.profile.ts -> src/contexts/installation/domain/m.model.ts",
    ]);
  });

  it("flags a profile that imports a file of another profile, and passes its own folder", () => {
    const base = "src/contexts/tools/domain/profiles";
    expect(
      importsOf({
        [`${base}/x/x.profile.ts`]:
          'import { Y } from "../y/y.profile.js";\nimport { Z } from "./z.js";',
        [`${base}/y/y.profile.ts`]: "export const Y = 1;",
        [`${base}/x/z.ts`]: "export const Z = 1;",
      })
    ).toEqual([`${base}/x/x.profile.ts -> ${base}/y/y.profile.ts`]);
  });

  it("flags composition imported by anything but composition", () => {
    expect(
      importsOf({
        "src/presentation/controllers/x.controller.ts":
          'import { wire } from "../../composition/a.composition.js";',
        "src/composition/a.composition.ts": "export const wire = 1;",
      })
    ).toEqual(["src/presentation/controllers/x.controller.ts -> src/composition/a.composition.ts"]);
  });

  it("flags a fake that imports another context's kit", () => {
    expect(
      importsOf({
        "tests/contexts/a/testing/x.fake.ts": 'import { Y } from "../../b/testing/y.fake.js";',
        "tests/contexts/b/testing/y.fake.ts": "export class Y {}",
      })
    ).toEqual(["tests/contexts/a/testing/x.fake.ts -> tests/contexts/b/testing/y.fake.ts"]);
  });

  it("flags a test of a context, a helper and the shared kit that import another context's kit", () => {
    const kit = {
      "tests/contexts/b/testing/y.fake.ts": "export class Y {}",
    };
    for (const file of [
      "tests/contexts/a/x/y.unit.test.ts",
      "tests/helpers/ports/h.ts",
      "tests/shared/testing/h.ts",
    ]) {
      const target = "tests/contexts/b/testing/y.fake.ts";
      const spec = posix.relative(posix.dirname(file), target).replace(/\.ts$/, ".js");
      expect(importsOf({ ...kit, [file]: `import { Y } from "${spec}";` })).toEqual([
        `${file} -> ${target}`,
      ]);
    }
  });

  it("lets orchestration tests and a context's own tests import the kits they compose", () => {
    expect(
      importsOf({
        "tests/contexts/b/testing/y.fake.ts": "export class Y {}",
        "tests/composition/c.unit.test.ts": 'import { Y } from "../contexts/b/testing/y.fake.js";',
        "tests/contexts/b/x/y.unit.test.ts": 'import { Y } from "../testing/y.fake.js";',
      })
    ).toEqual([]);
  });

  it("passes a fake that imports the shared kit and its own source", () => {
    expect(
      importsOf({
        "tests/contexts/a/testing/x.fake.ts":
          'import { Y } from "../../../shared/testing/y.fake.js";\nimport { P } from "../../../../src/contexts/a/ports/p.port.js";',
        "tests/shared/testing/y.fake.ts": "export class Y {}",
        "src/contexts/a/ports/p.port.ts": "export interface P {}",
      })
    ).toEqual([]);
  });

  it("holds every import of the tree, up to the debt", () => {
    const files: Record<string, string> = {};
    for (const path of [...codeFilesUnder("src"), ...codeFilesUnder("tests")]) {
      files[path] = readFileSync(join(CLI_ROOT, path), "utf8");
    }
    const { unlisted, stale } = debtVerdict(importViolations(files), loadDebt(), ["imports"]);
    expect(unlisted.map((violation) => violation.message)).toEqual([]);
    expect(stale).toEqual([]);
  });
});

describe("a source owes a test at its mirror path", () => {
  const model = "src/contexts/a/domain/x.model.ts";
  const missing = (
    sources: string[],
    tests: string[],
    shape: Shape = { typeOnly: false, behaviour: true }
  ) =>
    mirrorViolations(sources, tests, () => new Map(sources.map((source) => [source, shape]))).map(
      (violation) => violation.entry
    );

  it("flags a model with no test", () => {
    expect(missing([model], [])).toEqual([model]);
  });

  it("names the file, the rule and the fix", () => {
    const [violation] = mirrorViolations(
      [model],
      [],
      () => new Map([[model, { typeOnly: false, behaviour: true }]])
    );
    expect(violation?.rule).toBe("mirror");
    expect(violation?.message).toContain(model);
    expect(violation?.message).toContain("tests/contexts/a/domain/x.model.unit.test.ts");
  });

  it("clears a test of the required level at the mirror path", () => {
    expect(missing([model], ["tests/contexts/a/domain/x.model.unit.test.ts"])).toEqual([]);
  });

  it("clears a facet test and the test of an unsuffixed file", () => {
    expect(missing([model], ["tests/contexts/a/domain/x.model.edges.unit.test.ts"])).toEqual([]);
    const bare = "src/contexts/a/domain/x.ts";
    expect(missing([bare], ["tests/contexts/a/domain/x.unit.test.ts"])).toEqual([]);
  });

  it("flags a test in another folder, of another file, or of a level the kind does not take", () => {
    expect(missing([model], ["tests/contexts/a/application/x.model.unit.test.ts"])).toEqual([
      model,
    ]);
    expect(missing([model], ["tests/contexts/a/domain/xx.model.unit.test.ts"])).toEqual([model]);
    expect(missing([model], ["tests/contexts/a/domain/x.model.e2e.test.ts"])).toEqual([model]);
  });

  it("owes nothing for a port, composition or a type-only module", () => {
    expect(missing(["src/contexts/a/ports/p.port.ts"], [])).toEqual([]);
    expect(missing(["src/composition/a.composition.ts"], [])).toEqual([]);
    expect(missing([model], [], { typeOnly: true, behaviour: false })).toEqual([]);
  });

  it("owes nothing for the data file of a profile, but a profile function owes a test", () => {
    const data = "src/contexts/tools/domain/profiles/x/x-paths.ts";
    expect(missing([data], [], { typeOnly: false, behaviour: false })).toEqual([]);
    expect(missing([data], [], { typeOnly: false, behaviour: true })).toEqual([data]);
  });

  it("reads the shape only of the sources that lack a test", () => {
    const asked: string[][] = [];
    mirrorViolations(
      [model, "src/contexts/a/domain/y.model.ts"],
      ["tests/contexts/a/domain/y.model.unit.test.ts"],
      (sources) => {
        asked.push([...sources]);
        return new Map();
      }
    );
    expect(asked).toEqual([[model]]);
  });

  it("reads a module's shape from its text", () => {
    const shapes = shapesOf({
      "src/types.ts":
        'import type { A } from "./a.js";\nexport interface B { a: A; f: () => void }',
      "src/table.ts": "export const table = { a: 1 };",
      "src/logic.ts": "export const f = () => 1;",
      "src/klass.ts": "export class K {}",
    });
    expect(shapes.get("src/types.ts")).toEqual({ typeOnly: true, behaviour: false });
    expect(shapes.get("src/table.ts")).toEqual({ typeOnly: false, behaviour: false });
    expect(shapes.get("src/logic.ts")).toEqual({ typeOnly: false, behaviour: true });
    expect(shapes.get("src/klass.ts")).toEqual({ typeOnly: false, behaviour: true });
  });

  it("holds every source of the tree, up to the debt", () => {
    const sources = codeFilesUnder("src").filter(isInCatalog);
    const tests = codeFilesUnder("tests").filter((path) => matchesGlob("tests/**/*.test.ts", path));
    const found = mirrorViolations(sources, tests, (candidates) =>
      shapesOf(
        Object.fromEntries(
          candidates.map((path) => [path, readFileSync(join(CLI_ROOT, path), "utf8")])
        )
      )
    );
    const { unlisted, stale } = debtVerdict(found, loadDebt(), ["mirror"]);
    expect(unlisted.map((violation) => violation.message)).toEqual([]);
    expect(stale).toEqual([]);
  });
});

describe("a use case holds one shape", () => {
  const breaksOf = (path: string, text: string): string[] =>
    useCaseShapeBreaks({ [path]: text }).get(path) ?? [];
  const home = "src/contexts/a/application/";

  it("passes one class named after its file with a public execute", () => {
    expect(breaksOf(`${home}log-in.ts`, "export class LogIn { async execute(r: R) {} }")).toEqual(
      []
    );
  });

  it("flags a class that is not named after its file, and a second class", () => {
    expect(
      breaksOf(`${home}log-in.ts`, "export class Other { execute() {} }\nclass Two {}")
    ).toEqual(["2 classes, expected one", "no class named LogIn"]);
  });

  it("flags an execute that is not public", () => {
    expect(breaksOf(`${home}log-in.ts`, "export class LogIn { private execute() {} }")).toEqual([
      "an execute that is not public",
    ]);
  });

  it("flags a class that answers several questions through no execute, unless it implements a port", () => {
    const many = "export class X { a() {} b() {} }";
    expect(breaksOf(`${home}x.ts`, many)).toEqual(["2 public methods and no execute"]);
    expect(
      breaksOf(
        `${home}x.ts`,
        `import type { P } from "../ports/p.js";\nexport class X implements P { a() {} b() {} }`
      )
    ).toEqual([]);
  });

  it("flags public methods besides execute where a folder answers through execute alone", () => {
    expect(
      breaksOf(
        "src/contexts/host-registration/application/withdraw/x.ts",
        "export class X { execute() {} step() {} }"
      )
    ).toEqual(["public methods besides execute: step"]);
  });

  it("counts a destructured and an optional constructor parameter, and passes the limit", () => {
    const params = (n: number) =>
      Array.from({ length: n }, (_, i) => `private readonly p${i}?: P`).join(", ");
    expect(
      breaksOf(`${home}x.ts`, `export class X { constructor(${params(5)}) {} execute() {} }`)
    ).toEqual([]);
    expect(
      breaksOf(`${home}x.ts`, `export class X { constructor(${params(6)}) {} execute() {} }`)
    ).toEqual(["6 constructor dependencies, at most 5"]);
    expect(
      breaksOf(
        `${home}x.ts`,
        `export class X { constructor({ a, b, c, d, e, f }: O) {} execute() {} }`
      )
    ).toEqual(["6 constructor dependencies, at most 5"]);
  });

  it("flags the tool catalog taken by a method or an options type, and passes the constructor and a free function", () => {
    expect(breaksOf(`${home}x.ts`, "export class X { execute(t: ToolCatalog) {} }")).toEqual([
      "takes the tool catalog as a method parameter",
    ]);
    expect(
      breaksOf(
        `${home}x.ts`,
        "export class X { execute() {} }\ninterface O { tools: Pick<ToolCatalog, 'a'> }"
      )
    ).toEqual(["carries the tool catalog as a property"]);
    expect(
      breaksOf(
        `${home}x.ts`,
        "export class X { constructor(private readonly t: ToolCatalog) {} execute() {} }\nexport function f(t: ToolCatalog) {}"
      )
    ).toEqual([]);
  });

  it("selects the use cases of the tree", () => {
    expect(isUseCase("src/contexts/a/application/x.ts")).toBe(true);
    expect(isUseCase("src/contexts/a/domain/x.ts")).toBe(false);
    expect(isUseCase("tests/contexts/a/application/x.unit.test.ts")).toBe(false);
  });

  it("holds every use case of the tree, up to the debt", () => {
    const files: Record<string, string> = {};
    for (const path of codeFilesUnder("src").filter(isUseCase)) {
      files[path] = readFileSync(join(CLI_ROOT, path), "utf8");
    }
    expect(Object.keys(files).length, "the scope is stale").toBeGreaterThan(100);
    const { unlisted, stale } = debtVerdict(
      shapeViolations(useCaseShapeBreaks(files)),
      loadDebt(),
      ["shape"]
    );
    expect(unlisted.map((violation) => violation.message)).toEqual([]);
    expect(stale).toEqual([]);
  });
});

describe("debt only shrinks", () => {
  const violation = (rule: Violation["rule"], entry: string): Violation => ({
    rule,
    entry,
    message: `${entry} breaks ${rule}`,
  });
  const debt = {
    ...noDebt(),
    classification: ["a.ts"],
    imports: ["b.ts -> c.ts"],
    mirror: ["d.ts"],
  };

  it("passes when the violations are the debt", () => {
    const found = [
      violation("classification", "a.ts"),
      violation("imports", "b.ts -> c.ts"),
      violation("mirror", "d.ts"),
    ];
    expect(debtVerdict(found, debt)).toEqual({ unlisted: [], stale: [] });
  });

  it("flags a violation the debt does not list", () => {
    const found = [
      violation("classification", "a.ts"),
      violation("classification", "new.ts"),
      violation("imports", "b.ts -> c.ts"),
      violation("mirror", "d.ts"),
    ];
    expect(debtVerdict(found, debt).unlisted.map((v) => v.entry)).toEqual(["new.ts"]);
  });

  it("flags a listed entry that no longer violates", () => {
    const found = [violation("classification", "a.ts"), violation("mirror", "d.ts")];
    expect(debtVerdict(found, debt).stale).toEqual(["imports: b.ts -> c.ts"]);
  });

  it("keys an entry by its rule, so one file can be listed under two rules", () => {
    const found = [
      violation("mirror", "a.ts"),
      violation("imports", "b.ts -> c.ts"),
      violation("mirror", "d.ts"),
    ];
    const verdict = debtVerdict(found, debt);
    expect(verdict.unlisted.map((v) => v.entry)).toEqual(["a.ts"]);
    expect(verdict.stale).toEqual(["classification: a.ts"]);
  });
});
