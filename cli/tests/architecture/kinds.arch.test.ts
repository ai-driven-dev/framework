/**
 * The file-kind gate. `kinds.ts` is the table; this file holds the tree to it and holds each rule
 * to the case it names. No violation is tolerated: the tree holds every rule.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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
import { present } from "../shared/testing/present.builder.js";
import { KINDS, type Kind } from "./kind-table.js";
import { codeFilesUnder } from "./kind-tree.js";
import {
  classificationViolations,
  isInCatalog,
  isUseCase,
  kindsOf,
  mirrorViolations,
  type Shape,
  shapeViolations,
  strayViolations,
  type Violation,
} from "./kinds.js";
import { CLI_ROOT, canonicalPath, matchesGlob } from "./source-graph.js";
import { walk, withVirtualProject } from "./ts-project.js";
import { holdsUseCases, useCaseFilesWithoutSuffix, useCaseShapeBreaks } from "./use-case-shape.js";

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
    ["src/contexts/auth/domain/auth.error.ts", "error"],
    ["src/presentation/presentation.error.ts", "error"],
    ["src/presentation/presenters/auth.presenter.ts", "presenter"],
    ["src/presentation/controllers/auth.controller.ts", "controller"],
    ["src/composition/auth.composition.ts", "composition"],
    ["src/composition/orchestration/clean.ts", "composition"],
    ["tests/contexts/auth/application/log-in.unit.test.ts", "test"],
    ["tests/e2e/clean.e2e.test.ts", "test"],
    ["tests/contexts/auth/testing/auth.builder.ts", "builder"],
    ["tests/contexts/auth/testing/credentials.fake.ts", "fake"],
    ["tests/contexts/auth/testing/credentials.contract.ts", "contract-suite"],
    ["tests/setup/vitest-text-loader.ts", "setup"],
    ["tests/mutation/mutation-sequencer.ts", "setup"],
  ])("%s is a %s", (path, kind) => {
    expect(kindsOf(path)).toEqual([kind]);
    expect(violationsOf(path)).toEqual([]);
  });

  it("flags a file no kind claims, naming the file, the rule and the fix", () => {
    const [violation] = violationsOf("src/presentation/stray.ts");
    expect(violation?.entry).toBe("src/presentation/stray.ts");
    expect(violation?.rule).toBe("classification");
    expect(violation?.message).toContain("src/presentation/stray.ts");
    expect(violation?.message).toMatch(/matches no kind/);
    expect(violation?.message).toMatch(/Fix:/);
  });

  it("flags a test support file that carries no kind suffix", () => {
    expect(violationsOf("tests/shared/other.ts")).toHaveLength(1);
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
      "tests/architecture/source-graph.ts",
    ]) {
      expect(isInCatalog(path), path).toBe(false);
    }
  });

  it("flags a file of src that is neither source nor a glossary, such as a sed backup", () => {
    expect(
      strayViolations(["src/a.ts", "src/b.md", "src/a.ts-E", "tests/c.json"]).map((v) => v.entry)
    ).toEqual(["src/a.ts-E"]);
  });

  it("holds every file of the tree, with no violation", () => {
    const everyFile = readdirSync(join(CLI_ROOT, "src"), { recursive: true, encoding: "utf8" })
      .filter((entry) => statSync(join(CLI_ROOT, "src", entry)).isFile())
      .map((entry) => canonicalPath(join("src", entry)));
    expect(strayViolations(everyFile).map((violation) => violation.message)).toEqual([]);
    const paths = [...codeFilesUnder("src"), ...codeFilesUnder("tests")].filter(isInCatalog);
    expect(paths.length, "the scope is stale").toBeGreaterThan(500);
    expect(classificationViolations(paths).map((violation) => violation.message)).toEqual([]);
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

  it("holds every source of the tree, with no violation", () => {
    const sources = codeFilesUnder("src").filter(isInCatalog);
    const tests = codeFilesUnder("tests").filter((path) => matchesGlob("tests/**/*.test.ts", path));
    const found = mirrorViolations(sources, tests, (candidates) =>
      shapesOf(
        Object.fromEntries(
          candidates.map((path) => [path, readFileSync(join(CLI_ROOT, path), "utf8")])
        )
      )
    );
    expect(found.map((violation) => violation.message)).toEqual([]);
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

  it("counts each field of a dependencies bag declared in the file", () => {
    const bag = (n: number, form: "interface" | "type") => {
      const fields = Array.from({ length: n }, (_, i) => `readonly p${i}: P;`).join(" ");
      const declared =
        form === "interface" ? `interface D { ${fields} }` : `type D = { ${fields} };`;
      return `${declared}\nexport class X { constructor(private readonly deps: D) {} execute() {} }`;
    };
    expect(breaksOf(`${home}x.ts`, bag(5, "interface"))).toEqual([]);
    expect(breaksOf(`${home}x.ts`, bag(6, "interface"))).toEqual([
      "6 constructor dependencies, at most 5",
    ]);
    expect(breaksOf(`${home}x.ts`, bag(6, "type"))).toEqual([
      "6 constructor dependencies, at most 5",
    ]);
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

  it("holds every use case of the tree, with no violation", () => {
    const files: Record<string, string> = {};
    for (const path of codeFilesUnder("src").filter(isUseCase)) {
      files[path] = readFileSync(join(CLI_ROOT, path), "utf8");
    }
    expect(Object.keys(files).length, "the scope is stale").toBeGreaterThan(100);
    expect(
      shapeViolations(useCaseShapeBreaks(files)).map((violation) => violation.message)
    ).toEqual([]);
  });
});

describe("a class with a public execute is named as a use case", () => {
  const home = "src/contexts/a/application/";
  const executing = "export class LogIn { async execute(r: R) {} }";

  it("flags a file without the suffix, and none that carries it", () => {
    expect(
      useCaseFilesWithoutSuffix({
        [`${home}log-in.ts`]: executing,
        [`${home}sign-in.use-case.ts`]: executing,
        "src/orchestration/clean/wipe.ts": executing,
      })
    ).toEqual([`${home}log-in.ts`, "src/orchestration/clean/wipe.ts"]);
  });

  it("ignores private or static execute, other names, and files outside the use case folders", () => {
    expect(
      useCaseFilesWithoutSuffix({
        [`${home}a.ts`]: "export class A { private execute() {} }",
        [`${home}b.ts`]: "export class B { static execute() {} }",
        [`${home}c.ts`]: "export class C { run() {} }",
        [`${home}d.ts`]: "class D { execute() {} }",
        "src/contexts/a/domain/e.ts": executing,
      })
    ).toEqual([]);
  });

  it("holds every file of the tree", () => {
    const files: Record<string, string> = {};
    for (const path of codeFilesUnder("src").filter(holdsUseCases)) {
      files[path] = readFileSync(join(CLI_ROOT, path), "utf8");
    }
    expect(Object.keys(files).length, "the scope is stale").toBeGreaterThan(100);
    expect(useCaseFilesWithoutSuffix(files)).toEqual([]);
  });
});
