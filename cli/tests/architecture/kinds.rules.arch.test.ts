/**
 * The content rules of the kind gate (`kind-rules.ts`), each held to the case it names and then to
 * the real tree, up to the debt in `kinds-debt.json`. A listed entry that no longer violates
 * fails, so the fix removes it.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, contextNames, declaredCommands, tsFilesUnder } from "./helpers.js";
import {
  answerViolations,
  compositionViolations,
  constructionViolations,
  contractReaderViolations,
  controllerBuildsErrorViolations,
  drivingPortViolations,
  errorViolations,
  instructionViolations,
  isPortFile,
  portViolations,
  profileViolations,
  repositoryViolations,
  STORED_ANSWERS,
  scopeViolations,
  sectionViolations,
  sizeViolations,
  storedValueViolations,
  translateViolations,
} from "./kind-rules.js";
import { debtVerdict, loadDebt, type Rule, type Violation } from "./kinds.js";
import {
  CATALOG_PROFILE_METHODS,
  HANDS_PROFILE_ON,
  PROFILE_MODULE_FILE,
  profileReaders,
  wholeProfileFlowsInSources,
} from "./profile-flow.js";

const entries = (found: readonly Violation[]): string[] => found.map((v) => v.entry);

function expectUpToDebt(found: readonly Violation[], rule: Rule): void {
  const { unlisted, stale } = debtVerdict(found, loadDebt(), [rule]);
  expect(unlisted.map((violation) => violation.message)).toEqual([]);
  expect(stale).toEqual([]);
}

/** The `imports` debt is held entry by entry by the import test of `kinds.arch.test.ts`; a rule
 * beside it owes only that nothing it finds is unlisted, and the debt lists none of its own. */
function expectNoneBeyondDebt(found: readonly Violation[]): void {
  const { unlisted } = debtVerdict(found, loadDebt(), ["imports"]);
  expect(unlisted.map((violation) => violation.message)).toEqual([]);
}

const textsOf = (paths: readonly string[]): Record<string, string> =>
  Object.fromEntries(paths.map((path) => [path, readFileSync(join(CLI_ROOT, path), "utf8")]));

let sources: Record<string, string> | undefined;
const src = (): Record<string, string> =>
  (sources ??= textsOf(tsFilesUnder("src").filter((path) => !path.endsWith(".d.ts"))));

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

  it("clears a stored value the list keeps for a caller that needs it as it is", () => {
    const [kept] = STORED_ANSWERS;
    const source = `export class ${kept.member.split(".")[0]} {\n  ${kept.member.split(".")[1]}() { return this.#v; }\n}`;
    expect(storedValueViolations({ [kept.file]: source })).toHaveLength(1);
    expect(answerViolations({ [kept.file]: source })).toEqual([]);
  });

  it("keeps in the list only a stored value the tree still hands out, with its caller and reason", () => {
    const flagged = new Set(storedValueViolations(src()).map((v) => v.entry));
    for (const entry of STORED_ANSWERS) {
      expect(flagged.has(`${entry.file} :: ${entry.member}`)).toBe(true);
      expect(entry.caller).not.toBe("");
      expect(entry.reason).not.toBe("");
    }
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
    expect(
      found('join(CLI_ROOT, "..")', "tests/shared/testing/repository-root.builder.ts")
    ).toEqual([]);
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
    expectNoneBeyondDebt(drivingPortViolations(src()));
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
    expectNoneBeyondDebt(contractReaderViolations(files));
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
    expectUpToDebt(scopeViolations(files), "scope");
  });
});

describe("presentation builds no command and no adapter", () => {
  const files = (presentation: string) => ({
    "src/orchestration/menu.ts": "export class MenuLoop {}\nexport class SetupFlow {}",
    "src/contexts/a/infrastructure/b.adapter.ts": "export abstract class Gateway {}",
    "src/presentation/x.controller.ts": presentation,
  });
  const found = (presentation: string) => entries(constructionViolations(files(presentation)));

  it("reports a command and an adapter built in presentation", () => {
    expect(found("const m = new MenuLoop(a);\nconst g = new Gateway();")).toEqual([
      "src/presentation/x.controller.ts :: new Gateway",
      "src/presentation/x.controller.ts :: new MenuLoop",
    ]);
  });

  it("clears the value object presentation builds, and a class composition built", () => {
    expect(found("const s = new SetupFlow(a);\nconst e = new Error();")).toEqual([]);
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
    expectUpToDebt(constructionViolations(tree), "composition");
  });
});

const FLOW_TIMEOUT_MS = 30_000;

describe("a reader names the sections of a tool it reads", () => {
  it("holds the tree, up to the debt", { timeout: FLOW_TIMEOUT_MS }, () => {
    const tree = src();
    expect(
      profileReaders(tree).handsOn.length,
      "no file hands the profile on: the exemption reads nothing"
    ).toBeGreaterThan(0);
    expectUpToDebt(profileViolations(tree, CLI_ROOT), "profile");
  });

  it("lists every catalog method that answers a whole profile", () => {
    const answering = [
      ...(src()["src/contexts/tools/contract/tool-catalog.ts"]?.matchAll(
        /^\s+(\w+)\([^)]*\):[^;]*\b(?:Ai|Ide)?ToolProfile\b/gm
      ) ?? []),
    ].map((match) => match[1]);
    expect([...new Set(answering)].sort()).toEqual([...CATALOG_PROFILE_METHODS].sort());
  });

  it("reads a file that hands the profile on, multi-line or not", () => {
    const single =
      '// biome-ignore lint/plugin: hands it on\nimport type { AiToolProfile } from "../tools/contract/tool-profile.js";';
    const multi =
      '// biome-ignore lint/plugin: hands it on\nimport type {\n  AiToolProfile,\n} from "../tools/contract/tool-profile.js";';
    const bare = 'import type { AiToolProfile } from "../tools/contract/tool-profile.js";';
    expect(HANDS_PROFILE_ON.test(single)).toBe(true);
    expect(HANDS_PROFILE_ON.test(multi)).toBe(true);
    expect(HANDS_PROFILE_ON.test(bare)).toBe(false);
  });

  it("leaves out the tools context and the composition root", () => {
    const call = "tools.aiProfile('x');";
    expect(
      profileReaders({
        "src/a.ts": call,
        "src/contexts/tools/x.ts": call,
        "src/composition/c.ts": call,
      }).readers
    ).toEqual(["src/a.ts"]);
  });
});

describe("a reader names the sections of a tool it reads: the flow reading", () => {
  const MODULE = PROFILE_MODULE_FILE;
  const LISTED_CALLEE = "src/contexts/b/listed.ts";
  const project = (caller: string): Record<string, string> => ({
    [MODULE]: [
      "export interface AiToolProfile { kind: 'ai'; toolId: string; hostBinary(): string }",
      "export interface IdeToolProfile { kind: 'ide'; toolId: string }",
      "export type ToolProfile = AiToolProfile | IdeToolProfile;",
    ].join("\n"),
    "src/contexts/tools/contract/tool-catalog.ts": [
      "import type { AiToolProfile } from './tool-profile.js';",
      "export interface ToolCatalog { aiProfile(id: string): AiToolProfile }",
    ].join("\n"),
    "src/contexts/b/sinks.ts": [
      "import type { AiToolProfile } from '../tools/contract/tool-profile.js';",
      "export declare function whole(profile: AiToolProfile): void;",
      "export declare function narrow(profile: { toolId: string }): void;",
      "export declare function generic<T>(value: T): void;",
      "export declare function options(o: { tool: AiToolProfile }): void;",
      "export declare function narrowOptions(o: { tool: { toolId: string } }): void;",
    ].join("\n"),
    [LISTED_CALLEE]: [
      "import type { AiToolProfile } from '../tools/contract/tool-profile.js';",
      "export declare function handoff(profile: AiToolProfile): void;",
    ].join("\n"),
    "src/contexts/b/caller.ts": [
      "import { handoff } from './listed.js';",
      "import type { ToolCatalog } from '../tools/contract/tool-catalog.js';",
      "import { generic, narrow, narrowOptions, options, whole } from './sinks.js';",
      "declare const tools: ToolCatalog;",
      caller,
    ].join("\n"),
  });
  const flows = (caller: string, exempt: readonly string[] = []): string[] =>
    wholeProfileFlowsInSources(project(caller), MODULE, ["src/contexts/b/caller.ts"], exempt);

  it("flags a catalog profile passed directly into a whole-profile parameter", () => {
    expect(flows("whole(tools.aiProfile('x'));")).toHaveLength(1);
  });

  it("flags a profile passed through a name into a whole-profile parameter", () => {
    expect(flows("const p = tools.aiProfile('x');\nwhole(p);")).toHaveLength(1);
  });

  it("flags a profile inside an object literal argument whose property is the whole profile", () => {
    expect(flows("options({ tool: tools.aiProfile('x') });")).toHaveLength(1);
  });

  it("reports a reader of a planted project as a profile violation of its file", () => {
    const dir = mkdtempSync(join(tmpdir(), "aidd-profile-flow-"));
    try {
      const texts = project("whole(tools.aiProfile('x'));");
      for (const [path, text] of Object.entries(texts)) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
      }
      writeFileSync(
        join(dir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            noLib: true,
            types: [],
            module: "esnext",
            moduleResolution: "bundler",
          },
          files: Object.keys(texts),
        })
      );
      expect(entries(profileViolations(texts, dir))).toEqual(["src/contexts/b/caller.ts"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("clears a profile passed into a narrow parameter or a narrow property", () => {
    expect(flows("narrow(tools.aiProfile('x'));")).toEqual([]);
    expect(flows("narrowOptions({ tool: tools.aiProfile('x') });")).toEqual([]);
  });

  it("clears a profile passed to a generic call, whose parameter the compiler infers from it", () => {
    expect(flows("generic(tools.aiProfile('x'));")).toEqual([]);
  });

  it("clears a profile passed to a callee declared in an exempt file, and flags it otherwise", () => {
    const call = "handoff(tools.aiProfile('x'));";
    expect(flows(call, [LISTED_CALLEE])).toEqual([]);
    expect(flows(call)).toHaveLength(1);
  });
});

describe("a controller builds no error", () => {
  const error = 'import { GhostError, type Shape } from "../../shared/domain/shared.error.js";\n';
  const found = (path: string, body: string) =>
    entries(controllerBuildsErrorViolations({ [path]: error + body }));

  it("flags a controller that builds an error it imports from an error file", () => {
    expect(found("src/presentation/commands/a.ts", "throw new GhostError('x');")).toEqual([
      "src/presentation/commands/a.ts :: new GhostError",
    ]);
    expect(found("src/presentation/hooks/a.ts", "const e = new GhostError();")).toEqual([
      "src/presentation/hooks/a.ts :: new GhostError",
    ]);
  });

  it("clears an error only tested, a class of another file, and a file that is no controller", () => {
    expect(found("src/presentation/commands/a.ts", "if (e instanceof GhostError) return;")).toEqual(
      []
    );
    expect(found("src/presentation/commands/a.ts", "new Other();")).toEqual([]);
    expect(found("src/presentation/display/a.ts", "throw new GhostError();")).toEqual([]);
  });

  it("holds the tree", () => {
    const files = textsOf(tsFilesUnder("src/presentation"));
    expect(Object.keys(files).length).toBeGreaterThan(0);
    expectUpToDebt(controllerBuildsErrorViolations(files), "controllerBuildsError");
  });
});
