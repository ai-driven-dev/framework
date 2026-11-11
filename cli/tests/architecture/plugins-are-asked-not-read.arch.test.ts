/**
 * How a tool takes plugins is asked of its capability, never read off it: each answer is a
 * method, and the data behind it sits in one of three variants (native, flat, unsupported) that
 * hold only what their own way needs. A field read from outside re-couples a caller to a
 * variant's shape, and the shape is free to change.
 *
 * Two doors lead to the capability from outside the tools context: the typed section
 * (`tool.capabilities.plugins`) and the catalog resolver (`resolvePluginsCapability(id)`).
 * Both are watched for a property read or a destructuring. A capability held in a variable and
 * read from there is out of this test's sight; the private modifier on the fields is what
 * stops that one.
 */
import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, read, sourceFiles } from "./helpers.js";

const TOOLS_CONTEXT = /^(src|tests)\/contexts\/tools\//;

const PLUGINS_FILES = [
  "src/contexts/tools/domain/capabilities/plugins-capability.ts",
  "src/contexts/tools/domain/plugins/plugin-delivery.ts",
  "src/contexts/tools/domain/plugins/native-plugins.ts",
  "src/contexts/tools/domain/plugins/flat-plugins.ts",
  "src/contexts/tools/domain/plugins/unsupported-plugins.ts",
];

const DOORS = String.raw`(?:capabilities\.plugins|resolvePluginsCapability\([^)]*\)|PluginsCapability\))`;
const FIELD_READ = new RegExp(String.raw`${DOORS}\??\.(\w+)\b(?!\s*\()`, "g");
const DESTRUCTURING = new RegExp(String.raw`\}\s*=\s*[\w.?]*${DOORS}\s*;`, "g");

const CLASS_BLOCK = /^(?:export )?(?:abstract )?class (\w+)[^{]*\{([\s\S]*?)\n\}/gm;
const PUBLIC_FIELD =
  /^ {2}(?!private |protected |static |constructor|abstract |override |async |get |set )(?:public )?(?:readonly )?(\w+)[?!]?\s*[:=]/gm;

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
    }
  }
  return fields.sort();
}

describe("a tool's plugin delivery is asked, never read", () => {
  it("no code outside the tools context reads a field of a plugins capability", () => {
    expect(readsOutsideTools([...sourceFiles(), ...testFiles()])).toEqual([]);
  });

  it("no plugins class leaves a field readable", () => {
    expect(readableFields()).toEqual([]);
  });

  it("sees a read and a destructuring where one is written", () => {
    const written = [
      "const a = tool.capabilities.plugins.acceptsMcp;",
      "const { hookScript } = tool.capabilities.plugins;",
    ];
    const found = written.map((line) => [...line.matchAll(FIELD_READ)].length);
    const destructured = written.map((line) => [...line.matchAll(DESTRUCTURING)].length);
    expect([found, destructured]).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });
});
