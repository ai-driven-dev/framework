/**
 * How a tool takes plugins is asked of its capability, never read off it: each answer is a
 * method, and the data behind it sits in one of three variants (native, flat, unsupported) that
 * hold only what their own way needs. A field read from outside re-couples a caller to a
 * variant's shape, and the shape is free to change.
 *
 * Three doors lead to the capability from outside the tools context: the section a profile
 * answers (`tool.section("plugins")`), the catalog resolver (`resolvePluginsCapability(id)`) and
 * the native narrowing (`resolveNativePlugins(id)`). All are watched for a property read or a destructuring. A capability held in a variable and
 * read from there is out of this test's sight; a `#` field is what stops that one, where the
 * compiler refuses a cast or an element access that the `private` keyword lets through.
 */
import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, read, sourceFiles } from "./helpers.js";

const TOOLS_CONTEXT = /^(src|tests)\/contexts\/tools\//;

const ANSWERING_DIRS = [
  "src/contexts/tools/domain/capabilities",
  "src/contexts/tools/domain/plugins",
];
/** Declarations a profile hands over as data, whose fields are read as they are written. */
const DATA_DECLARATIONS = [
  "src/contexts/tools/domain/plugins/native-activation.ts",
  "src/contexts/tools/domain/plugins/marketplace-registration.ts",
];

const DOORS = String.raw`(?:section\(\s*"plugins"\s*\)|resolvePluginsCapability\([^)]*\)|resolveNativePlugins\([^)]*\)|PluginsCapability\))`;
/** `kind` is the one read allowed: the discriminant a caller narrows the variant on. */
const FIELD_READ = new RegExp(String.raw`${DOORS}\??\.(?!kind\b)(\w+)\b(?!\s*\()`, "g");
const DESTRUCTURING = new RegExp(String.raw`\}\s*=\s*[\w.?]*${DOORS}\s*;`, "g");

const CLASS_BLOCK = /^(?:export )?(?:abstract )?class (\w+)[^{]*\{([\s\S]*?)\n\}/gm;
const PUBLIC_FIELD =
  /^ {2}(?!static |constructor|abstract |override |async |get |set )(?:(?:public|private|protected) )?(?:readonly )?(\w+)[?!]?\s*[:=]/gm;
/** A parameter property cannot be a `#` field, so it is refused outright. */
const PARAMETER_PROPERTY = /constructor\([^)]*\b(?:public|private|protected|readonly)\s+(\w+)/g;
/** A getter that only hands back a stored value is a field read renamed. */
const STORED_VALUE_GETTER = /^ {2}get (\w+)\(\)[^{]*\{\s*return this\.#?[\w.]+;\s*\}/gm;

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

function answeringFiles(): string[] {
  return ANSWERING_DIRS.flatMap((dir) =>
    readdirSync(join(CLI_ROOT, dir))
      .filter((entry) => entry.endsWith(".ts"))
      .map((entry) => `${dir}/${entry}`)
  ).filter((file) => !DATA_DECLARATIONS.includes(file));
}

/** What a class leaves readable in one source: each entry is a read a caller can make. */
function readableIn(file: string, source: string): string[] {
  const fields: string[] = [];
  for (const block of source.matchAll(CLASS_BLOCK)) {
    const body = block[2] as string;
    for (const pattern of [PUBLIC_FIELD, PARAMETER_PROPERTY, STORED_VALUE_GETTER]) {
      for (const field of body.matchAll(pattern)) fields.push(`${file} :: ${block[1]}.${field[1]}`);
    }
  }
  return fields;
}

/** Every stored value a capability or plugins class lets a caller read instead of asking. */
function readableFields(): string[] {
  return answeringFiles()
    .flatMap((file) => readableIn(file, read(file)))
    .sort();
}

describe("a tool's plugin delivery is asked, never read", () => {
  it("no code outside the tools context reads a field of a plugins capability", () => {
    expect(readsOutsideTools([...sourceFiles(), ...testFiles()])).toEqual([]);
  });

  it("no capability or plugins class leaves a stored value readable", () => {
    expect(readableFields()).toEqual([]);
  });

  it("sees a public field, a keyword-private one, a parameter property and a stored-value getter, and clears a # field", () => {
    const planted = [
      "class A {",
      "  readonly open: string;",
      "  private readonly secret: string;",
      "  readonly #hidden: string;",
      "  constructor(private readonly leaked: string) {}",
      "  get echoed(): string {",
      "    return this.#hidden;",
      "  }",
      "  get kind(): string {",
      '    return "a";',
      "  }",
      "  ask(): string {",
      "    return this.#hidden;",
      "  }",
      "}",
    ].join("\n");
    expect(readableIn("a.ts", planted)).toEqual([
      "a.ts :: A.open",
      "a.ts :: A.secret",
      "a.ts :: A.leaked",
      "a.ts :: A.echoed",
    ]);
  });

  it("reads every capability and plugins file, and none of the data declarations", () => {
    const files = answeringFiles();
    expect(files).toContain("src/contexts/tools/domain/capabilities/settings-capability.ts");
    expect(files).toContain("src/contexts/tools/domain/plugins/native-plugins.ts");
    for (const declaration of DATA_DECLARATIONS) expect(files).not.toContain(declaration);
  });

  it("sees a read and a destructuring where one is written", () => {
    const written = [
      'const a = tool.section("plugins").acceptsMcp;',
      'const b = tool.section("plugins")?.acceptsMcp;',
      'const { hookScript } = tool.section("plugins");',
      "const c = catalog.resolvePluginsCapability(id).acceptsMcp;",
      "const e = (x as PluginsCapability).acceptsMcp;",
      "const f = catalog.resolveNativePlugins(id).hookScript;",
    ];
    const found = written.map((line) => [...line.matchAll(FIELD_READ)].length);
    const destructured = written.map((line) => [...line.matchAll(DESTRUCTURING)].length);
    expect([found, destructured]).toEqual([
      [1, 1, 0, 1, 1, 1],
      [0, 0, 1, 0, 0, 0],
    ]);

    const asked = 'const d = tool.section("plugins").buildMode();';
    expect([...asked.matchAll(FIELD_READ)]).toHaveLength(0);

    const narrowed = 'if (tool.section("plugins").kind === "flat") return;';
    expect([...narrowed.matchAll(FIELD_READ)]).toHaveLength(0);
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

/** Answers that belong to one variant alone; the base holds none of them. */
const VARIANT_ONLY = [
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
  return VARIANT_ONLY.filter((name) =>
    new RegExp(String.raw`^  (?:abstract )?${name}\(`, "m").test(source)
  );
}
