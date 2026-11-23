/**
 * The shape of a use case, `use-case-shape.ts`, held to each case it names and over the tree.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeFilesUnder } from "./kind-tree.js";
import { isUseCase, shapeViolations } from "./kinds.js";
import { CLI_ROOT } from "./source-graph.js";
import {
  treeUseCaseShapeBreaks,
  useCaseFilesWithoutSuffix,
  useCaseShapeBreaks,
} from "./use-case-shape.js";

const home = "src/contexts/a/application/";
/** A collaborator: it answers through a method, so it counts as one dependency. */
const PORT = "interface P { run(): void }\n";
const fields = (n: number, type = "P") =>
  Array.from({ length: n }, (_, i) => `readonly p${i}: ${type};`).join(" ");
const taking = (type: string) =>
  `export class X { constructor(private readonly deps: ${type}) {} execute() {} }`;

describe("a use case holds one shape", () => {
  const breaksOf = (path: string, text: string): string[] =>
    useCaseShapeBreaks({ [path]: text }).get(path) ?? [];

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

  it("flags public methods besides execute in any use case, unless it implements a port", () => {
    expect(breaksOf(`${home}x.ts`, "export class X { execute() {} step() {} }")).toEqual([
      "public methods besides execute: step",
    ]);
    expect(
      breaksOf(
        `${home}x.ts`,
        `import type { P } from "../ports/p.js";\nexport class X implements P { execute() {} step() {} }`
      )
    ).toEqual([]);
  });

  it("exempts a class that implements a port from the dependency limit", () => {
    const params = Array.from({ length: 6 }, (_, i) => `private readonly p${i}: P`).join(", ");
    const body = `constructor(${params}) {} execute() {}`;
    expect(breaksOf(`${home}x.ts`, `${PORT}export class X { ${body} }`)).toEqual([
      "6 constructor dependencies, at most 5",
    ]);
    expect(
      breaksOf(
        `${home}x.ts`,
        `import type { S } from "../ports/s.js";\n${PORT}export class X implements S { ${body} }`
      )
    ).toEqual([]);
  });

  it("flags a repository typed with the records it keeps beside it", () => {
    const declared =
      "interface ManifestRepository { load(): void }\ninterface ScopeRecords { read(): void }\ninterface Rules { rule(): void }\n";
    expect(
      breaksOf(
        `${home}x.ts`,
        `${declared}export class X { constructor(private readonly repo: ManifestRepository & ScopeRecords) {} execute() {} }`
      )
    ).toEqual(["types a repository with ScopeRecords"]);
    expect(
      breaksOf(
        `${home}x.ts`,
        `${declared}export class X { constructor(private readonly records: Rules & ScopeRecords) {} execute() {} }`
      )
    ).toEqual([]);
  });

  it("flags a use-case file that exports no class with a public execute", () => {
    expect(breaksOf(`${home}x.use-case.ts`, "export class X { run() {} }")).toEqual([
      "no exported class with a public execute",
    ]);
    expect(breaksOf(`${home}x.use-case.ts`, "export class X { execute() {} }")).toEqual([]);
  });

  it("counts a destructured and an optional constructor parameter, and passes the limit", () => {
    const params = (n: number) =>
      Array.from({ length: n }, (_, i) => `private readonly p${i}?: P`).join(", ");
    expect(
      breaksOf(`${home}x.ts`, `${PORT}export class X { constructor(${params(5)}) {} execute() {} }`)
    ).toEqual([]);
    expect(
      breaksOf(`${home}x.ts`, `${PORT}export class X { constructor(${params(6)}) {} execute() {} }`)
    ).toEqual(["6 constructor dependencies, at most 5"]);
    expect(
      breaksOf(
        `${home}x.ts`,
        `${PORT}interface O { ${fields(6)} }\nexport class X { constructor({ p0, p1, p2, p3, p4, p5 }: O) {} execute() {} }`
      )
    ).toEqual(["6 constructor dependencies, at most 5"]);
  });

  it("counts each field of a dependencies bag declared in the file", () => {
    const bag = (n: number, form: "interface" | "type") => {
      const declared =
        form === "interface" ? `interface D { ${fields(n)} }` : `type D = { ${fields(n)} };`;
      return `${PORT}${declared}\n${taking("D")}`;
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
        "interface ToolCatalog { all(): void }\nexport class X { constructor(private readonly t: ToolCatalog) {} execute() {} }\nexport function f(t: ToolCatalog) {}"
      )
    ).toEqual([]);
  });

  it("holds every use case of the tree, with no violation", () => {
    const found = treeUseCaseShapeBreaks(CLI_ROOT);
    expect(codeFilesUnder("src").filter(isUseCase).length, "the scope is stale").toBeGreaterThan(
      100
    );
    expect(shapeViolations(found).map((violation) => violation.message)).toEqual([]);
  });
});

describe("a dependencies bag counts by its fields wherever its type is declared", () => {
  const use = `${home}x.ts`;
  const breaksOf = (files: Readonly<Record<string, string>>): string[] =>
    useCaseShapeBreaks({ "src/contexts/a/ports/p.ts": `export ${PORT}`, ...files }).get(use) ?? [];
  const importP = 'import type { P } from "../ports/p.js";\n';

  it("counts a bag imported from another file", () => {
    expect(
      breaksOf({
        "src/contexts/a/ports/deps.ts": `${importP}export interface D { ${fields(6)} }`,
        [use]: `import type { D } from "../ports/deps.js";\n${taking("D")}`,
      })
    ).toEqual(["6 constructor dependencies, at most 5"]);
  });

  it("counts a nested bag a use-case file declares by its own fields", () => {
    expect(
      breaksOf({
        [`${home}shared/inner.ts`]: `${importP.replace("../", "../../")}export interface Inner { ${fields(5)} }`,
        [use]: `${importP}import type { Inner } from "./shared/inner.js";\ninterface D { readonly p: P; readonly built: Inner }\n${taking("D")}`,
      })
    ).toEqual(["6 constructor dependencies, at most 5"]);
  });

  it("counts the fields a bag inherits and those of an intersection", () => {
    const base = `${importP}interface Base { ${fields(3)} }\n`;
    expect(
      breaksOf({
        [use]: `${base}interface D extends Base { ${fields(3, "P").replaceAll("p", "q")} }\n${taking("D")}`,
      })
    ).toEqual(["6 constructor dependencies, at most 5"]);
    expect(
      breaksOf({
        [use]: `${base}type More = { ${fields(3).replaceAll("p", "q")} };\n${taking("Base & More")}`,
      })
    ).toEqual(["6 constructor dependencies, at most 5"]);
  });

  it("counts a nested port, model or contract type as one, whatever its fields", () => {
    expect(
      breaksOf({
        "src/contexts/a/ports/layout.ts": `export interface Layout { ${fields(9, "string")} }`,
        [use]: `${importP}import type { Layout } from "../ports/layout.js";\ninterface D { ${fields(4)} readonly layout: Layout }\n${taking("D")}`,
      })
    ).toEqual([]);
  });

  it("refuses a dependency type the checker cannot resolve", () => {
    expect(() => breaksOf({ [use]: taking("Missing") })).toThrow(/an unresolved dependency type/);
  });
});

describe("a class with a public execute is named as a use case", () => {
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
        [`${home}f.model.ts`]: executing,
      })
    ).toEqual([]);
  });

  it("holds every file of the tree", () => {
    const files: Record<string, string> = {};
    for (const path of codeFilesUnder("src").filter(isUseCase)) {
      files[path] = readFileSync(join(CLI_ROOT, path), "utf8");
    }
    expect(Object.keys(files).length, "the scope is stale").toBeGreaterThan(100);
    expect(useCaseFilesWithoutSuffix(files)).toEqual([]);
  });
});
