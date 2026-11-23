/**
 * The content rules of the kind gate (`kind-rules.ts`), each held to the case it names and then to
 * the real tree, which holds every rule with no violation tolerated.
 */
import { describe, expect, it } from "vitest";
import { entries, expectNone, src, textsOf } from "./kind-rule-fixtures.js";
import {
  compositionViolations,
  constructionViolations,
  contractReaderViolations,
  controllerBuildsErrorViolations,
  drivingPortViolations,
  errorTextViolations,
  errorViolations,
  instructionViolations,
  isPortFile,
  portViolations,
} from "./kind-rules.js";
import { contextNames, declaredCommands, tsFilesUnder } from "./source-graph.js";

/** The codes every `*.error.ts` declares, and the ones carried twice or not in kebab-case. */
function errorCodeViolations(files: Record<string, string>): {
  codes: string[];
  duplicated: string[];
  malformed: string[];
} {
  const codes = Object.entries(files)
    .filter(([path]) => path.endsWith(".error.ts"))
    .flatMap(([, text]) => [
      ...[...text.matchAll(/readonly code = "([^"]+)"/g)].map((match) => match[1] ?? ""),
      ...[...(/type \w+Code = ([^;]+);/.exec(text)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
        (match) => match[1] ?? ""
      ),
    ]);
  return {
    codes,
    duplicated: [...new Set(codes.filter((code, index) => codes.indexOf(code) !== index))],
    malformed: codes.filter((code) => !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(code)),
  };
}

describe("an error class is thrown", () => {
  const catalog = "src/shared/domain/shared.error.ts";
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

  it("flags a code carried twice or not in kebab-case, whichever file declares it", () => {
    const planted = {
      "src/contexts/a/domain/a.error.ts": 'class AError { readonly code = "same-code"; }',
      "src/contexts/b/domain/b.error.ts":
        'class BError { readonly code = "same-code"; }\nclass CError { readonly code = "Not_Kebab"; }',
      "src/contexts/b/domain/b.ts": 'const x = { code: "ignored" };',
    };
    const { codes, duplicated, malformed } = errorCodeViolations(planted);
    expect(codes).toEqual(["same-code", "same-code", "Not_Kebab"]);
    expect(duplicated).toEqual(["same-code"]);
    expect(malformed).toEqual(["Not_Kebab"]);
  });

  it("gives every error a kebab-case code no other error carries", () => {
    const { codes, duplicated, malformed } = errorCodeViolations(src());
    expect(codes.length).toBeGreaterThan(0);
    expect(malformed).toEqual([]);
    expect(duplicated).toEqual([]);
  });

  it("holds the catalog of the tree", () => {
    const files = src();
    const declaring = Object.keys(files).filter((path) => path.endsWith(".error.ts"));
    expect(declaring.length, "the catalog moved").toBeGreaterThan(0);
    expectNone(errorViolations(files, declaring));
  });
});

describe("an error carries no text", () => {
  const found = (body: string) =>
    entries(errorTextViolations({ "src/a/domain/a.error.ts": body, "src/a/b.ts": "super('x');" }));

  it("flags a string, a template with and without substitution handed to super", () => {
    expect(found('class A { constructor() { super("words"); } }')).toHaveLength(1);
    expect(found("class A { constructor() { super(`words`); } }")).toHaveLength(1);
    expect(found("class A { constructor(x: string) { super(`words $" + "{x}`); } }")).toHaveLength(
      1
    );
  });

  it("clears a cause only, and reads no file that is not an error", () => {
    expect(found("class A { constructor(o?: ErrorOptions) { super(o); } }")).toEqual([]);
    expect(found("class A { constructor() { super(); } }")).toEqual([]);
    expect(found('class A { constructor(o?: ErrorOptions) { super("", o); } }')).toEqual([]);
  });

  it("holds the tree", () => {
    expectNone(errorTextViolations(src()));
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
    expectNone(instructionViolations(surface, declaredCommands()));
  });
});

describe("composition holds one module per context", () => {
  const found = (files: string[], contexts: string[]) =>
    entries(compositionViolations(files, contexts));

  it("names the module a context lacks, the module no context owns and a context module at the root", () => {
    const files = [
      "container",
      "shared",
      "tool-profiles.composition",
      "user-config-dir",
      "tools",
      "contexts/tools",
      "contexts/stray",
    ].map((m) => `src/composition/${m}.ts`);
    expect(found(files, ["tools", "recipes"])).toEqual([
      "extra module: tools",
      "missing module: contexts/recipes",
      "extra module: contexts/stray",
    ]);
  });

  it("names a subfolder that is not contexts or orchestration, and ignores files inside one", () => {
    const files = [
      "container",
      "shared",
      "tool-profiles.composition",
      "user-config-dir",
      "orchestration/setup",
      "extras/a",
    ].map((m) => `src/composition/${m}.ts`);
    expect(found(files, [])).toEqual(["unexpected subfolder: extras"]);
  });

  it("holds the composition folder of the tree", () => {
    expectNone(compositionViolations(Object.keys(src()), contextNames()));
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
    expectNone(portViolations(new Map(Object.entries(files))));
  });
});

describe("the driving port names context types only", () => {
  const port = "src/orchestration/deps.ts";
  const found = (text: string) => entries(drivingPortViolations({ [port]: text }));

  it("reports a value import and an import type of an interior file", () => {
    expect(
      found(
        'import { A } from "../contexts/a/application/a.use-case.js";\nimport type { B } from "../contexts/b/domain/b.model.js";'
      )
    ).toEqual([
      `${port} -> ../contexts/a/application/a.use-case.js`,
      `${port} -> ../contexts/b/domain/b.model.js`,
    ]);
  });

  it("clears an import type of an application or a contract file", () => {
    expect(
      found(
        'import type { A } from "../contexts/a/application/a.use-case.js";\nimport type { C } from "../contexts/c/contract/c.model.js";\nimport { s } from "../shared/s.js";'
      )
    ).toEqual([]);
  });

  it("holds the tree", () => {
    expect(src()[port], "the driving port moved").toBeDefined();
    expectNone(drivingPortViolations(src()));
  });
});

describe("a contract file is read from outside its context", () => {
  const contract = "src/contexts/a/contract/c.model.ts";
  const found = (files: Record<string, string>) => entries(contractReaderViolations(files));

  it("reports one only its context, the composition root or the driving port imports", () => {
    expect(
      found({
        [contract]: "export const C = 1;",
        "src/contexts/a/application/x.use-case.ts": 'import { C } from "../contract/c.model.js";',
        "src/composition/a.ts": 'import { C } from "../contexts/a/contract/c.model.js";',
        "src/orchestration/deps.ts": 'import type { C } from "../contexts/a/contract/c.model.js";',
      })
    ).toEqual([contract]);
  });

  it("clears one another context or presentation imports", () => {
    expect(
      found({
        [contract]: "export const C = 1;",
        "src/contexts/b/application/x.use-case.ts":
          'import { C } from "../../a/contract/c.model.js";',
      })
    ).toEqual([]);
    expect(
      found({
        [contract]: "export const C = 1;",
        "src/presentation/p.presenter.ts": 'import { C } from "../contexts/a/contract/c.model.js";',
      })
    ).toEqual([]);
  });

  it("holds the tree", () => {
    const files = src();
    expect(Object.keys(files).filter((path) => path.includes("/contract/")).length).toBeGreaterThan(
      0
    );
    expectNone(contractReaderViolations(files));
  });
});

describe("only composition builds a command, a use case or an adapter", () => {
  const files = (presentation: string) => ({
    "src/orchestration/menu.ts": "export class MenuLoop {}",
    "src/orchestration/domain/flow.model.ts": "export class Flow {}",
    "src/orchestration/orchestration.error.ts": "export class MenuError extends Error {}",
    "src/contexts/a/infrastructure/b.adapter.ts": "export abstract class Gateway {}",
    "src/contexts/a/infrastructure/lock.ts": "export class Lock {}",
    "src/presentation/x.controller.ts": presentation,
  });
  const found = (presentation: string) => entries(constructionViolations(files(presentation)));

  it("reports a command and an adapter built in presentation", () => {
    expect(found("const m = new MenuLoop(a);\nconst g = new Gateway();")).toEqual([
      "src/presentation/x.controller.ts :: new Gateway",
      "src/presentation/x.controller.ts :: new MenuLoop",
    ]);
  });

  it("reports an infrastructure class whose file is not named as an adapter", () => {
    expect(found("const l = new Lock();")).toEqual([
      "src/presentation/x.controller.ts :: new Lock",
    ]);
  });

  it("clears a model, an error and a class no file declares", () => {
    expect(found("new Flow(a);\nnew MenuError();\nnew Error();")).toEqual([]);
  });

  it("reports a use case and an adapter that build another one", () => {
    expect(
      entries(
        constructionViolations({
          ...files(""),
          "src/contexts/a/application/c.use-case.ts":
            "new MenuLoop();\nnew Planner();\nnew Swapper();",
          "src/contexts/a/application/planner.use-case.ts": "export class Planner {}",
          "src/contexts/a/application/swap-translator.ts": "export class Swapper {}",
          "src/contexts/a/infrastructure/d.adapter.ts": "new Gateway();",
          "src/orchestration/e.ts": "new Gateway();",
        })
      )
    ).toEqual([
      "src/contexts/a/application/c.use-case.ts :: new MenuLoop",
      "src/contexts/a/application/c.use-case.ts :: new Planner",
      "src/contexts/a/application/c.use-case.ts :: new Swapper",
      "src/contexts/a/infrastructure/d.adapter.ts :: new Gateway",
      "src/orchestration/e.ts :: new Gateway",
    ]);
  });

  it("reports the binary entry too, and not composition", () => {
    expect(
      entries(
        constructionViolations({
          ...files(""),
          "src/cli.ts": "new MenuLoop();",
          "src/composition/c.ts": "new MenuLoop();",
        })
      )
    ).toEqual(["src/cli.ts :: new MenuLoop"]);
  });

  it("holds the tree", () => {
    const tree = src();
    expect(Object.keys(tree).some((path) => path.startsWith("src/presentation/"))).toBe(true);
    expect(entries(constructionViolations(tree))).toEqual([]);
  });
});

describe("a controller builds no error", () => {
  const error = 'import { GhostError, type Shape } from "../../shared/domain/shared.error.js";\n';
  const found = (path: string, body: string) =>
    entries(controllerBuildsErrorViolations({ [path]: error + body }));

  it("flags a controller that builds an error it imports from an error file", () => {
    expect(
      found("src/presentation/controllers/a.controller.ts", "throw new GhostError('x');")
    ).toEqual(["src/presentation/controllers/a.controller.ts :: new GhostError"]);
    expect(found("src/presentation/hooks/a.ts", "const e = new GhostError();")).toEqual([
      "src/presentation/hooks/a.ts :: new GhostError",
    ]);
  });

  it("clears an error only tested, a class of another file, and a file that is no controller", () => {
    expect(
      found("src/presentation/controllers/a.controller.ts", "if (e instanceof GhostError) return;")
    ).toEqual([]);
    expect(found("src/presentation/controllers/a.controller.ts", "new Other();")).toEqual([]);
    expect(found("src/presentation/presenters/a.presenter.ts", "throw new GhostError();")).toEqual(
      []
    );
  });

  it("holds the tree", () => {
    const files = textsOf(tsFilesUnder("src/presentation"));
    expect(Object.keys(files).length).toBeGreaterThan(0);
    expectNone(controllerBuildsErrorViolations(files));
  });
});
