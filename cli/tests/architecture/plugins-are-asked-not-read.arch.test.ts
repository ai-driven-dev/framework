/**
 * How a tool takes plugins is asked of its capability, never read off it: each answer is a
 * method, and the data behind it sits in one of three variants (native, flat, unsupported) that
 * hold only what their own way needs. A field read from outside re-couples a caller to a
 * variant's shape, and the shape is free to change.
 *
 * Two doors lead to the capability from outside the tools context: the section a profile
 * answers (`tool.section("plugins")`) and the catalog resolver (`resolvePluginsCapability(id)`).
 * Both are watched for a property read or a destructuring. A capability held in a variable and
 * read from there is out of this test's sight; a `#` field is what stops that one, where the
 * compiler refuses a cast or an element access that the `private` keyword lets through.
 */
import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, read, sourceFiles } from "./helpers.js";

const TOOLS_CONTEXT = /^(src|tests)\/contexts\/tools\//;

const PLUGINS_FILES = [
  "src/contexts/tools/domain/plugins/plugins-capability.ts",
  "src/contexts/tools/domain/plugins/plugin-params.ts",
  "src/contexts/tools/domain/plugins/plugin-delivery.ts",
  "src/contexts/tools/domain/plugins/native-plugins.ts",
  "src/contexts/tools/domain/plugins/flat-plugins.ts",
  "src/contexts/tools/domain/plugins/unsupported-plugins.ts",
];

const DOORS = String.raw`(?:section\(\s*"plugins"\s*\)|resolvePluginsCapability\([^)]*\)|PluginsCapability\))`;
/** `kind` is the one read allowed: the discriminant a caller narrows the variant on. */
const FIELD_READ = new RegExp(String.raw`${DOORS}\??\.(?!kind\b)(\w+)\b(?!\s*\()`, "g");
const DESTRUCTURING = new RegExp(String.raw`\}\s*=\s*[\w.?]*${DOORS}\s*;`, "g");

/** A capability's declared parameters, read from a section or from a variable named for one. */
const PARAMS_READ =
  /(?:section\([^)]*\)|\b(?:mcp|hooks|settings|agents|skills|commands|rules|capability|cap)(?:Capability)?)\??\.params\b/g;
const CAPABILITY_FILES_DIR = "src/contexts/tools/domain/capabilities";

const CLASS_BLOCK = /^(?:export )?(?:abstract )?class (\w+)[^{]*\{([\s\S]*?)\n\}/gm;
const PUBLIC_FIELD =
  /^ {2}(?!static |constructor|abstract |override |async |get |set )(?:(?:public|private|protected) )?(?:readonly )?(\w+)[?!]?\s*[:=]/gm;
/** A parameter property cannot be a `#` field, so it is refused outright. */
const PARAMETER_PROPERTY = /constructor\([^)]*\b(?:public|private|protected|readonly)\s+(\w+)/g;

function testFiles(): string[] {
  return readdirSync(join(CLI_ROOT, "tests"), { recursive: true, encoding: "utf8" })
    .map((entry) => join("tests", entry).split(sep).join("/"))
    .filter(
      (path) =>
        path.endsWith(".ts") &&
        !path.startsWith("tests/fixtures/") &&
        !path.startsWith("tests/architecture/")
    );
}

/** Where code outside the tools context reads from a plugins capability instead of asking it. */
function readsOutsideTools(files: readonly string[]): string[] {
  const reads: string[] = [];
  for (const file of files.filter((path) => !TOOLS_CONTEXT.test(path))) {
    const text = read(file);
    for (const match of text.matchAll(FIELD_READ)) reads.push(`${file} :: reads .${match[1]}`);
    for (const _match of text.matchAll(DESTRUCTURING)) reads.push(`${file} :: destructures`);
  }
  return reads.sort();
}

/** The fields a plugins class leaves readable: each is a read a caller can make. */
function readableFields(): string[] {
  const fields: string[] = [];
  for (const file of PLUGINS_FILES) {
    for (const block of read(file).matchAll(CLASS_BLOCK)) {
      for (const field of (block[2] as string).matchAll(PUBLIC_FIELD)) {
        fields.push(`${file} :: ${block[1]}.${field[1]}`);
      }
      for (const prop of (block[2] as string).matchAll(PARAMETER_PROPERTY)) {
        fields.push(`${file} :: ${block[1]}.${prop[1]}`);
      }
    }
  }
  return fields.sort();
}

/** Where code outside the tools context reads the declared parameters of a section. */
function paramsReadsOutsideTools(files: readonly string[]): string[] {
  const reads: string[] = [];
  for (const file of files.filter((path) => !TOOLS_CONTEXT.test(path))) {
    for (const _match of read(file).matchAll(PARAMS_READ)) reads.push(`${file} :: reads .params`);
  }
  return reads.sort();
}

/** The capability classes that leave their parameters readable. */
function readableParams(): string[] {
  const leaks: string[] = [];
  for (const entry of readdirSync(join(CLI_ROOT, CAPABILITY_FILES_DIR))) {
    if (!entry.endsWith("-capability.ts")) continue;
    const file = `${CAPABILITY_FILES_DIR}/${entry}`;
    for (const block of read(file).matchAll(CLASS_BLOCK)) {
      for (const field of (block[2] as string).matchAll(PUBLIC_FIELD)) {
        if (field[1] === "params") leaks.push(`${file} :: ${block[1]}.params`);
      }
      for (const prop of (block[2] as string).matchAll(PARAMETER_PROPERTY)) {
        if (prop[1] === "params") leaks.push(`${file} :: ${block[1]}.params`);
      }
    }
  }
  return leaks.sort();
}

describe("a tool's plugin delivery is asked, never read", () => {
  it("no code outside the tools context reads a field of a plugins capability", () => {
    expect(readsOutsideTools([...sourceFiles(), ...testFiles()])).toEqual([]);
  });

  it("no plugins class leaves a field readable", () => {
    expect(readableFields()).toEqual([]);
  });

  it("sees a keyword-private field and a parameter property, and clears a # field", () => {
    const planted = [
      "class A {",
      "  private readonly secret: string;",
      "  readonly #hidden: string;",
      "  constructor(private readonly leaked: string) {}",
      "}",
    ].join("\n");
    const block = [...planted.matchAll(CLASS_BLOCK)][0]?.[2] as string;
    expect([...block.matchAll(PUBLIC_FIELD)].map((m) => m[1])).toEqual(["secret"]);
    expect([...block.matchAll(PARAMETER_PROPERTY)].map((m) => m[1])).toEqual(["leaked"]);
  });

  it("sees a read and a destructuring where one is written", () => {
    const written = [
      'const a = tool.section("plugins").acceptsMcp;',
      'const b = tool.section("plugins")?.acceptsMcp;',
      'const { hookScript } = tool.section("plugins");',
      "const c = catalog.resolvePluginsCapability(id).acceptsMcp;",
    ];
    const found = written.map((line) => [...line.matchAll(FIELD_READ)].length);
    const destructured = written.map((line) => [...line.matchAll(DESTRUCTURING)].length);
    expect([found, destructured]).toEqual([
      [1, 1, 0, 1],
      [0, 0, 1, 0],
    ]);

    const asked = 'const d = tool.section("plugins").buildMode();';
    expect([...asked.matchAll(FIELD_READ)]).toHaveLength(0);

    const narrowed = 'if (tool.section("plugins").kind === "flat") return;';
    expect([...narrowed.matchAll(FIELD_READ)]).toHaveLength(0);
  });

  it("no code outside the tools context reads a section's parameters", () => {
    expect(paramsReadsOutsideTools([...sourceFiles(), ...testFiles()])).toEqual([]);
  });

  it("no capability class leaves its parameters readable", () => {
    expect(readableParams()).toEqual([]);
  });

  it("sees a parameters read on a section or a capability variable, and clears a named answer", () => {
    const written = [
      'const a = tool.section("mcp").params.outputPath;',
      "const b = mcp.params.format;",
      "const c = capability?.params.mergeStrategy;",
      'const d = tool.section("mcp").outputPath();',
    ];
    expect(written.map((line) => [...line.matchAll(PARAMS_READ)].length)).toEqual([1, 1, 1, 0]);

    const leaky =
      "class A {\n  constructor(readonly params: string) {}\n  readonly params2 = 1;\n}";
    const block = [...leaky.matchAll(CLASS_BLOCK)][0]?.[2] as string;
    expect([...block.matchAll(PARAMETER_PROPERTY)].map((m) => m[1])).toEqual(["params"]);
  });

  it("the shared base declares no answer only one way of taking plugins has", () => {
    const base = read("src/contexts/tools/domain/plugins/plugin-delivery.ts");
    expect(variantOnlyAnswersOn(base)).toEqual([]);
  });

  it("sees a variant-only answer declared on a base, and clears a shared one", () => {
    const placeholder = "  manifestPath(): string | null {\n    return null;\n  }";
    expect(variantOnlyAnswersOn(placeholder)).toEqual(["manifestPath"]);
    expect(variantOnlyAnswersOn("  globalFiles(): GlobalFiles | null {")).toEqual([]);
  });
});

/** Answers that belong to the native variant alone; the base holds none of them. */
const NATIVE_ONLY = [
  "translatesAsMarketplace",
  "requiresUserScope",
  "manifestPath",
  "rootToken",
  "trustNotice",
  "activation",
  "marketplaceRegistration",
  "enablementIsMachineGlobal",
  "pluginOutputDir",
  "hookScript",
];

function variantOnlyAnswersOn(source: string): string[] {
  return NATIVE_ONLY.filter((name) =>
    new RegExp(String.raw`^  (?:abstract )?${name}\(`, "m").test(source)
  );
}
