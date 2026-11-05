/**
 * The shape of dead code knip cannot see: a port declares a method, an adapter implements it,
 * both reference the name, and nobody checks a *caller* exists. Deliberately coarse — it asks
 * whether `.someMethod(` appears anywhere outside the port's own file, so it proves only that
 * nothing spells the name as a call, never that a real path reaches it.
 *
 * A capability class is held to the same rule, on a stricter reading of a call: its method
 * names (`merge`, `equals`, `accepts`) are shared by other types, so `.merge(` alone cleared
 * `HooksCapability.merge` while nothing called it. A call counts only when its receiver names
 * a capability: the class's own key (`hooks`, `mcpCap`) or `cap`, as every caller in src does.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, canonicalPath, expectRatchet, SRC, sourceFiles } from "./helpers.js";

/** "ports" must be its own path segment: a substring check also matches `supports/` and
 * `reports/`. */
function portFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".ts") && /(^|\/)ports\//.test(canonicalPath(full))) {
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

const CAPABILITY_FILE = /^src\/contexts\/[^/]+\/domain\/capabilities\/[^/]+\.ts$/;
const CAPABILITY_CLASS = /^export class (\w+)Capability\b[^{]*\{([\s\S]*?)\n\}/gm;
const CLASS_METHOD = /^ {2}(?:async )?(\w+)\s*(?:<[^>]*>)?\(/gm;

/**
 * Capability methods with no caller in src today, by class. Every one is called only by its
 * own unit test or a profile test, which reads a declared behaviour nothing in the product
 * uses. The list may only shrink.
 */
const CAPABILITY_BASELINE: readonly {
  readonly file: string;
  readonly className: string;
  readonly methods: readonly string[];
  readonly count: number;
  readonly reason: string;
}[] = [
  {
    file: "src/contexts/tools/domain/capabilities/agents-capability.ts",
    className: "AgentsCapability",
    methods: ["accepts", "deserialize", "equals"],
    count: 3,
    reason: "called only by tests; the translate pipeline reads agents through the build contract",
  },
  {
    file: "src/contexts/tools/domain/capabilities/commands-capability.ts",
    className: "CommandsCapability",
    methods: ["accepts", "equals"],
    count: 2,
    reason: "called only by tests",
  },
  {
    file: "src/contexts/tools/domain/capabilities/hooks-capability.ts",
    className: "HooksCapability",
    methods: ["accepts", "equals", "getEntrySection", "merge"],
    count: 4,
    reason:
      "called only by tests; hooks merge through each profile's own merge function, never `merge`",
  },
  {
    file: "src/contexts/tools/domain/capabilities/mcp-capability.ts",
    className: "McpCapability",
    methods: ["accepts", "equals", "merge"],
    count: 3,
    reason: "called only by tests; MCP config merges through the file adapter's strategy",
  },
  {
    file: "src/contexts/tools/domain/capabilities/plugins-capability.ts",
    className: "PluginsCapability",
    methods: ["pluginOutputDir", "resolvePluginsBaseDir"],
    count: 2,
    reason: "called only by profile tests",
  },
  {
    file: "src/contexts/tools/domain/capabilities/rules-capability.ts",
    className: "RulesCapability",
    methods: ["accepts", "equals"],
    count: 2,
    reason: "called only by tests",
  },
  {
    file: "src/contexts/tools/domain/capabilities/settings-capability.ts",
    className: "SettingsCapability",
    methods: ["accepts", "equals"],
    count: 2,
    reason: "called only by tests",
  },
  {
    file: "src/contexts/tools/domain/capabilities/skills-capability.ts",
    className: "SkillsCapability",
    methods: ["accepts", "equals"],
    count: 2,
    reason: "called only by tests",
  },
];

function capabilityFiles(files: readonly string[]): string[] {
  return files.filter((file) => CAPABILITY_FILE.test(file)).sort();
}

/** `this.m(` in the class's own file, or `<receiver>.m(` elsewhere whose receiver names the
 * capability; a receiver that is a call (`resolvePluginsCapability(id)?.m(`) is read by its
 * callee name. */
function uncalledCapabilityMethods(
  bodies: ReadonlyMap<string, string>,
  capabilities: readonly string[]
): string[] {
  const uncalled: string[] = [];
  for (const file of capabilities) {
    for (const block of (bodies.get(file) ?? "").matchAll(CAPABILITY_CLASS)) {
      const key = (block[1] as string).toLowerCase();
      for (const method of (block[2] as string).matchAll(CLASS_METHOD)) {
        const name = method[1] as string;
        if (name === "constructor") continue;
        const call = new RegExp(`([\\w$]+)(?:\\([^()]*\\))?\\??\\.${name}\\s*\\(`, "g");
        const called = [...bodies].some(([caller, body]) =>
          [...body.matchAll(call)].some((match) => {
            const receiver = (match[1] as string).toLowerCase();
            if (caller === file) return receiver === "this";
            return receiver.includes(key) || receiver.includes("cap");
          })
        );
        if (!called) uncalled.push(`${file} :: ${block[1]}Capability.${name}`);
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

describe("a capability declares nothing nobody calls", () => {
  it("every capability method is called in src through a receiver naming a capability", () => {
    const bodies = new Map(
      sourceFiles().map((file) => [file, readFileSync(join(CLI_ROOT, file), "utf8")])
    );

    const uncalled = uncalledCapabilityMethods(bodies, capabilityFiles(sourceFiles()));

    const { added, fixed } = expectRatchet(
      uncalled,
      CAPABILITY_BASELINE.flatMap((entry) =>
        entry.methods.map((method) => `${entry.file} :: ${entry.className}.${method}`)
      )
    );
    expect(added, "a capability declares a method nothing in src calls").toEqual([]);
    expect(fixed, "fixed — remove these from CAPABILITY_BASELINE").toEqual([]);
  });

  it("states each baseline entry's count as the number of its methods", () => {
    for (const entry of CAPABILITY_BASELINE) {
      expect(entry.methods.length, entry.className).toBe(entry.count);
    }
  });

  it("finds the capability classes, so the rule cannot pass by selecting nothing", () => {
    expect(
      capabilityFiles(sourceFiles()).length,
      "no capability file found — the scope of this rule is stale"
    ).toBeGreaterThan(5);
  });
});

describe("the guard itself", () => {
  const capability = "src/contexts/tools/domain/capabilities/thing-capability.ts";
  const thing = [
    "export class ThingCapability {",
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

  it("names the capability method nobody calls, and clears the ones a capability receiver calls", () => {
    const bodies = new Map([
      [capability, thing],
      ["src/contexts/framework/application/caller.ts", "tool.capabilities.thing.used();"],
    ]);

    expect(uncalledCapabilityMethods(bodies, [capability])).toEqual([
      `${capability} :: ThingCapability.merge`,
    ]);
  });

  it("does not read another type's method of the same name as a call to the capability's", () => {
    const bodies = new Map([
      [capability, thing],
      ["src/contexts/framework/application/caller.ts", "cap.used();\nformat.merge(a, b);"],
    ]);

    expect(uncalledCapabilityMethods(bodies, [capability])).toEqual([
      `${capability} :: ThingCapability.merge`,
    ]);
  });

  it("reads a call through a generic capability receiver or a capability resolver", () => {
    const bodies = new Map([
      [capability, thing],
      [
        "src/contexts/framework/application/caller.ts",
        "capability.used();\nresolveThingCapability(id)?.merge(a, b);",
      ],
    ]);

    expect(uncalledCapabilityMethods(bodies, [capability])).toEqual([]);
  });

  it("names the port method nothing spells as a call, and clears the one a caller spells", () => {
    const port = "src/kernel/ports/thing.ts";
    const bodies = new Map([
      [
        port,
        ["export interface Thing {", "  doIt(x: number): void;", "  gone(): void;", "}"].join("\n"),
      ],
      ["src/runtime/caller.ts", "thing.doIt(1);"],
    ]);

    expect(uncalledMethods(bodies, [port])).toEqual([`${port} :: Thing.gone`]);
  });

  it("does not read an adapter implementing a method as a caller of it", () => {
    const port = "src/kernel/ports/thing.ts";
    const bodies = new Map([
      [port, ["export interface Thing {", "  doIt(x: number): void;", "}"].join("\n")],
      ["src/runtime/thing-adapter.ts", "class ThingAdapter { doIt(x: number): void {} }"],
    ]);

    expect(uncalledMethods(bodies, [port])).toEqual([`${port} :: Thing.doIt`]);
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
