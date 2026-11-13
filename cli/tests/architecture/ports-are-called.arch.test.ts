/**
 * The shape of dead code knip cannot see: a port declares a method, an adapter implements it,
 * both reference the name, and nobody checks a *caller* exists. Deliberately coarse — it asks
 * whether `.someMethod(` appears anywhere outside the port's own file, so it proves only that
 * nothing spells the name as a call, never that a real path reaches it.
 *
 * A section class is held to the same rule, on a stricter reading of a call: its method
 * names (`merge`, `equals`, `accepts`) are shared by other types, so `.merge(` alone would clear
 * a section's `merge` while nothing called it. A call counts only when its receiver is an
 * identifier naming the section (`hooks`, `mcpCap`, `section`), a `…Section` resolver
 * call, or `this` in the class's own file. Getters and statics count too.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, canonicalPath, expectRatchet, SRC, sourceFiles } from "./helpers.js";

/** "ports" and "contract" must be their own path segment: a substring check also matches
 * `supports/` and `reports/`. A `contract/` file is a port the context offers others, so its
 * methods need a caller as much as a `ports/` one. */
function isPortFile(path: string): boolean {
  return /(^|\/)(ports|contract)\//.test(path);
}

function portFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".ts") && isPortFile(canonicalPath(full))) {
        out.push(canonicalPath(relative(CLI_ROOT, full)));
      }
    }
  };
  walk(SRC);
  return out.sort();
}

const INTERFACE_BLOCK = /^export interface (\w+) \{([\s\S]*?)\n\}/gm;
const METHOD_SIGNATURE = /^ {2}(\w+)\(/gm;

function declaredMethods(file: string, source: string): string[] {
  const declared: string[] = [];
  for (const block of source.matchAll(INTERFACE_BLOCK)) {
    for (const method of (block[2] as string).matchAll(METHOD_SIGNATURE)) {
      declared.push(`${file} :: ${block[1]}.${method[1]}`);
    }
  }
  return declared;
}

/** Empty, and it stays empty: an uncalled port method is a missing caller or a dead
 * declaration, and both are closed by fixing the code rather than recording it. */
const BASELINE: readonly string[] = [];

function uncalledMethods(bodies: ReadonlyMap<string, string>, ports: readonly string[]): string[] {
  const uncalled: string[] = [];
  for (const port of ports) {
    for (const declared of declaredMethods(port, bodies.get(port) ?? "")) {
      const method = declared.slice(declared.lastIndexOf(".") + 1);
      const called = [...bodies].some(
        ([file, body]) => file !== port && new RegExp(`\\.${method}\\s*\\(`).test(body)
      );
      if (!called) uncalled.push(declared);
    }
  }
  return uncalled.sort();
}

const SECTION_FILE = /^src\/contexts\/[^/]+\/domain\/sections\/[^/]+\.ts$/;
const SECTION_CLASS = /^export class (\w+)Section\b[^{]*\{([\s\S]*?)\n\}/gm;
const CLASS_METHOD = /^ {2}(?:(static) )?(?:async )?(?:(get) )?(\w+)\s*(?:<[^>]*>)?\(/gm;

/**
 * Section methods with no caller in src today, by class. Every one is called only by its
 * own unit test or a profile test, which reads a declared behaviour nothing in the product
 * uses. The list may only shrink.
 */
const SECTION_BASELINE: readonly {
  readonly file: string;
  readonly className: string;
  readonly methods: readonly string[];
  readonly reason: string;
}[] = [
  {
    file: "src/contexts/tools/domain/sections/agents-section.ts",
    className: "AgentsSection",
    methods: ["accepts", "deserialize", "equals"],
    reason: "called only by tests; the translate pipeline reads agents through the build contract",
  },
  {
    file: "src/contexts/tools/domain/sections/commands-section.ts",
    className: "CommandsSection",
    methods: ["accepts", "equals"],
    reason: "called only by tests",
  },
  {
    file: "src/contexts/tools/domain/sections/rules-section.ts",
    className: "RulesSection",
    methods: ["accepts", "equals"],
    reason: "called only by tests",
  },
  {
    file: "src/contexts/tools/domain/sections/config-section.ts",
    className: "ConfigSection",
    methods: ["accepts", "equals"],
    reason: "called only by tests",
  },
  {
    file: "src/contexts/tools/domain/sections/skills-section.ts",
    className: "SkillsSection",
    methods: ["accepts", "equals"],
    reason: "called only by tests",
  },
];

function sectionFiles(files: readonly string[]): string[] {
  return files.filter((file) => SECTION_FILE.test(file)).sort();
}

/** The receivers a section is reached through in src: its key (`hooks`), the key with
 * `Cap` or `Section`, or the generic `cap`, `section` and `capability` (the field name the contract's write answers carry). Matched as whole identifiers:
 * `escaped` or `hooksList` is another value. */
function namesSection(receiver: string, key: string): boolean {
  const name = receiver.toLowerCase();
  return [key, `${key}cap`, `${key}section`, "cap", "section", "capability"].includes(name);
}

/**
 * A method is called through `this.m(` in its class's own file, or `<receiver>.m(` elsewhere
 * whose receiver names the section, or whose receiver is a call to a `…Section`
 * resolver (`resolvePluginsSection(id)?.m(`) or to `section` with its key (`tool.section("rules").m(`). A getter is read without the parentheses; a
 * static is called on the class itself.
 */
function uncalledSectionMethods(
  bodies: ReadonlyMap<string, string>,
  sections: readonly string[]
): string[] {
  const uncalled: string[] = [];
  for (const file of sections) {
    for (const block of (bodies.get(file) ?? "").matchAll(SECTION_CLASS)) {
      const className = `${block[1]}Section`;
      const key = (block[1] as string).toLowerCase();
      for (const member of (block[2] as string).matchAll(CLASS_METHOD)) {
        const [, isStatic, isGetter, name] = member;
        if (name === "constructor") continue;
        const use = new RegExp(
          `([\\w$]+)(\\([^()]*\\))?\\??\\.${name}${isGetter ? "\\b(?!\\s*\\()" : "\\s*\\("}`,
          "g"
        );
        const called = [...bodies].some(([caller, body]) =>
          [...body.matchAll(use)].some((match) => {
            const receiver = match[1] as string;
            if (caller === file && receiver === "this") return true;
            if (caller === file) return false;
            if (isStatic) return receiver === className;
            if (match[2] !== undefined) {
              return (
                /Section$/.test(receiver) || (receiver === "section" && match[2] === `("${key}")`)
              );
            }
            return namesSection(receiver, key);
          })
        );
        if (!called) uncalled.push(`${file} :: ${className}.${name}`);
      }
    }
  }
  return uncalled.sort();
}

describe("a port declares nothing nobody calls", () => {
  it("every method a port declares is spelled as a call somewhere in src", () => {
    const bodies = new Map(
      sourceFiles().map((file) => [file, readFileSync(join(CLI_ROOT, file), "utf8")])
    );

    const uncalled = uncalledMethods(bodies, portFiles());

    const { added, fixed } = expectRatchet(uncalled, BASELINE);
    expect(
      added,
      "a port declares a method nothing calls — an adapter implementing it is not a caller"
    ).toEqual([]);
    expect(fixed, "fixed — remove these from BASELINE").toEqual([]);
  });

  it("finds the ports of this codebase, so the rule cannot pass by selecting nothing", () => {
    expect(
      portFiles().length,
      "no port file found — the scope of this rule is stale"
    ).toBeGreaterThan(10);
  });
});

describe("a section declares nothing nobody calls", () => {
  it("every section method is called in src through a receiver naming a section", () => {
    const bodies = new Map(
      sourceFiles().map((file) => [file, readFileSync(join(CLI_ROOT, file), "utf8")])
    );

    const uncalled = uncalledSectionMethods(bodies, sectionFiles(sourceFiles()));

    const { added, fixed } = expectRatchet(
      uncalled,
      SECTION_BASELINE.flatMap((entry) =>
        entry.methods.map((method) => `${entry.file} :: ${entry.className}.${method}`)
      )
    );
    expect(added, "a section declares a method nothing in src calls").toEqual([]);
    expect(fixed, "fixed — remove these from SECTION_BASELINE").toEqual([]);
  });

  it("finds the section classes, so the rule cannot pass by selecting nothing", () => {
    expect(
      sectionFiles(sourceFiles()).length,
      "no section file found — the scope of this rule is stale"
    ).toBeGreaterThan(5);
  });
});

describe("the guard itself", () => {
  const section = "src/contexts/tools/domain/sections/thing-section.ts";
  const thing = [
    "export class ThingSection {",
    "  constructor(readonly params: { a: string }) {}",
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

  it("names the section method nobody calls, and clears the ones a section receiver calls", () => {
    const bodies = new Map([
      [section, thing],
      ["src/contexts/framework/application/caller.ts", "tool.sections.thing.used();"],
    ]);

    expect(uncalledSectionMethods(bodies, [section])).toEqual([`${section} :: ThingSection.merge`]);
  });

  it("does not read another type's method of the same name as a call to the section's", () => {
    const bodies = new Map([
      [section, thing],
      ["src/contexts/framework/application/caller.ts", "cap.used();\nformat.merge(a, b);"],
    ]);

    expect(uncalledSectionMethods(bodies, [section])).toEqual([`${section} :: ThingSection.merge`]);
  });

  it("reads a call through a generic section receiver or a section resolver", () => {
    const bodies = new Map([
      [section, thing],
      [
        "src/contexts/framework/application/caller.ts",
        "section.used();\nresolveThingSection(id)?.merge(a, b);",
      ],
    ]);

    expect(uncalledSectionMethods(bodies, [section])).toEqual([]);
  });

  it("reads a receiver as a whole identifier, never one that merely contains the key or cap", () => {
    const bodies = new Map([
      [section, thing],
      [
        "src/contexts/framework/application/caller.ts",
        "thing.used();\nescaped.merge(a, b);\ncapture.merge(a, b);\nthingConfig.merge(a, b);\nthingList.merge(a, b);",
      ],
    ]);

    expect(uncalledSectionMethods(bodies, [section])).toEqual([`${section} :: ThingSection.merge`]);
  });

  it("names an unread getter and an uncalled static, and clears the ones read through the section", () => {
    const withMembers = thing.replace(
      "\n}",
      [
        "",
        "  get plantedGetter(): string {",
        '    return "x";',
        "  }",
        "  static plantedStatic(): void {}",
        "  get readGetter(): string {",
        '    return "y";',
        "  }",
        "  static calledStatic(): void {}",
        "}",
      ].join("\n")
    );
    const bodies = new Map([
      [section, withMembers],
      [
        "src/contexts/framework/application/caller.ts",
        "thing.used();\nthing.merge(a, b);\nconst v = thing.readGetter;\nThingSection.calledStatic();\nother.plantedGetter;\nother.plantedStatic();",
      ],
    ]);

    expect(uncalledSectionMethods(bodies, [section])).toEqual([
      `${section} :: ThingSection.plantedGetter`,
      `${section} :: ThingSection.plantedStatic`,
    ]);
  });

  it("names the port method nothing spells as a call, and clears the one a caller spells", () => {
    const port = "src/kernel/ports/thing.ts";
    const bodies = new Map([
      [
        port,
        ["export interface Thing {", "  doIt(x: number): void;", "  gone(): void;", "}"].join("\n"),
      ],
      ["src/composition/caller.ts", "thing.doIt(1);"],
    ]);

    expect(uncalledMethods(bodies, [port])).toEqual([`${port} :: Thing.gone`]);
  });

  it("does not read an adapter implementing a method as a caller of it", () => {
    const port = "src/kernel/ports/thing.ts";
    const bodies = new Map([
      [port, ["export interface Thing {", "  doIt(x: number): void;", "}"].join("\n")],
      [
        "src/shared/infrastructure/thing-adapter.ts",
        "class ThingAdapter { doIt(x: number): void {} }",
      ],
    ]);

    expect(uncalledMethods(bodies, [port])).toEqual([`${port} :: Thing.doIt`]);
  });

  it("reads a contract folder as ports, and a folder merely ending in ports as none", () => {
    expect(isPortFile("src/contexts/auth/contract/token-provider.ts")).toBe(true);
    expect(isPortFile("src/contexts/auth/ports/identity-verifier.ts")).toBe(true);
    expect(isPortFile("src/contexts/telemetry/domain/ports/forget/measurement-erasure.ts")).toBe(
      true
    );
    expect(isPortFile("src/presentation/reports/summary.ts")).toBe(false);
    expect(isPortFile("src/contexts/auth/domain/credential-record.ts")).toBe(false);
  });

  it("reads a method off an interface block and ignores a property", () => {
    const source = [
      "export interface Thing {",
      "  readonly name: string;",
      "  doIt(x: number): void;",
      "}",
    ].join("\n");

    expect(declaredMethods("src/kernel/ports/thing.ts", source)).toEqual([
      "src/kernel/ports/thing.ts :: Thing.doIt",
    ]);
  });
});
