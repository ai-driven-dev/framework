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
  "src/contexts/tools/domain/sections",
  "src/contexts/tools/domain/native-registration",
  "src/contexts/tools/domain/plugins",
];

const DOORS = String.raw`(?:section\(\s*"plugins"\s*\)|resolvePluginsCapability\([^)]*\)|resolveNativePlugins\([^)]*\)|PluginsCapability\)|\.plugins\(\)|\.nativeActivation\(\))`;
/** `kind` is the one read allowed: the discriminant a caller narrows the variant on. */
const FIELD_READ = new RegExp(String.raw`${DOORS}\??\.(?!kind\b)(\w+)\b(?!\s*\()`, "g");
const DESTRUCTURING = new RegExp(String.raw`\}\s*=\s*[\w.?]*${DOORS}\s*;`, "g");

const CLASS_BLOCK = /^(?:export )?(?:abstract )?class (\w+)[^{]*\{([\s\S]*?)\n\}/gm;
const PUBLIC_FIELD =
  /^ {2}(?!static |constructor|abstract |override |async |get |set )(?:(?:public|private|protected) )?(?:readonly )?(\w+)[?!]?\s*[:=]/gm;
/** A parameter property cannot be a `#` field, so it is refused outright. */
const PARAMETER_PROPERTY = /constructor\([^)]*\b(?:public|private|protected|readonly)\s+(\w+)/g;
/** What a stored-value answer hands back: a stored field, an optional read of one, a `?? literal`
 * default over it, or a spread copy of it. A call in the expression makes it a computation. */
const STORED = String.raw`(?:this\.#?\w+(?:\??\.\w+)*(?: \?\? [^;()]+)?|\{\s*\.\.\.this\.#?\w+(?:\.\w+)*\s*\})`;
/** A getter that only hands back a stored value is a field read renamed. */
const STORED_VALUE_GETTER = new RegExp(
  String.raw`^ {2}(?:override )?get (\w+)\(\)[^{]*\{\s*return ${STORED};\s*\}`,
  "gm"
);
/** So is a method whose whole body returns a stored field: the same read, with parentheses. */
const STORED_VALUE_METHOD = new RegExp(
  String.raw`^ {2}(?!get |set )(?:override )?(?:public )?(\w+)(?:<[^>]*>)?\([^)]*\)[^{]*\{\s*return ${STORED};\s*\}`,
  "gm"
);
/** So is a method that returns an object literal built only of stored fields, read straight or
 * through a local alias of one: the declaration handed out whole, field by field. */
const STORED_OBJECT_COPY =
  /^ {2}(?!get |set )(?:override )?(?:public )?(\w+)\([^)]*\)[^{]*\{\s*(?:const (\w+) = this\.#?\w+;\s*)?return \{\s*(?:(?:\.\.\.this\.#?\w+|\w+: (?:this\.#?\w+|\w+)\.\w+),\s*)+\};\s*\}/gm;

/** Stored values a variant still answers verbatim, each with the caller that needs the value itself.
 * The eleven on the plugin delivery classes are the answers `plan-tools-clean.md` section 3.1
 * names; the others are declared values recorded there with their reason. Shrink-only: an entry the code no longer matches fails the test, and none is added. */
const STORED_ANSWERS_ALLOWED: Readonly<Record<string, string>> = {
  "src/contexts/tools/domain/native-registration/native-activation.ts :: NativeActivation.hostBinary":
    "the executable is the key every host registry and driver is looked up by; no computation sits behind it",
  "src/contexts/tools/domain/native-registration/native-activation.ts :: NativeActivation.cliShape":
    "the composition root configures the host CLI adapter with the whole declared shape; an answer per field would make the adapter ask the tool nine times for what it is handed once",
  "src/contexts/tools/domain/native-registration/native-activation.ts :: NativeActivation.marketplaceSourcesDeclaration":
    "the composition root picks the source reader by the declared form, which carries its own list command and wording",
  "src/contexts/tools/domain/native-registration/marketplace-registration.ts :: MarketplaceRegistration.sharedSettingsFile":
    "the path that names the tracked file in the manifest, resolved against a project root and hashed by its caller",
  "src/contexts/tools/domain/sections/hooks-section.ts :: HooksSection.outputPath":
    "the declared destination, asked by the framework install use cases (config, runtime config) and written into the manifest",
  "src/contexts/tools/domain/sections/hooks-section.ts :: HooksSection.mergeStrategy":
    "the declared way the hooks file is merged, recorded on each installed file by the framework install use cases",
  "src/contexts/tools/domain/sections/mcp-section.ts :: McpSection.outputPath":
    "the declared destination, asked by the framework install use cases (config, runtime config)",
  "src/contexts/tools/domain/sections/mcp-section.ts :: McpSection.mergeStrategy":
    "the declared way the mcp file is merged, recorded on each installed file by the framework install use cases",
  "src/contexts/tools/domain/sections/config-section.ts :: ConfigSection.outputPath":
    "the declared destination, asked by the framework install use cases (ide tool, runtime config) and written into the manifest",
  "src/contexts/tools/domain/sections/config-section.ts :: ConfigSection.mergeStrategy":
    "the declared way the settings file is merged, handed to the file merge by the framework install use cases",
  "src/contexts/tools/domain/sections/config-section.ts :: ConfigSection.requiredTool":
    "the declared tool a settings section applies to, matched against the installed one by the ide tool and runtime config install use cases",
  "src/contexts/tools/domain/plugins/flat-plugins.ts :: FlatPlugins.flatLayout":
    "the declared layout of a flat tool, asked by the flat build",
  "src/contexts/tools/domain/plugins/flat-plugins.ts :: FlatPlugins.hooksAcceptance":
    "the declared hooks stance, asked by every caller that places hooks",
  "src/contexts/tools/domain/plugins/flat-plugins.ts :: FlatPlugins.projectHooksDelivery":
    "the declared project hooks delivery, asked by the hooks installer",
  "src/contexts/tools/domain/plugins/native-plugins.ts :: NativePlugins.activation":
    "hands back the native activation entity, which answers for itself",
  "src/contexts/tools/domain/plugins/native-plugins.ts :: NativePlugins.marketplaceRegistration":
    "hands back the marketplace registration entity, which answers for itself",
  "src/contexts/tools/domain/plugins/native-plugins.ts :: NativePlugins.hooksAcceptance":
    "the declared hooks stance, asked by every caller that places hooks",
  "src/contexts/tools/domain/plugins/native-plugins.ts :: NativePlugins.hooksFilePath":
    "the declared hooks file, asked by the plugin content translator, which places the hooks manifest and the scripts beside it",
  "src/contexts/tools/domain/plugins/native-plugins.ts :: NativePlugins.manifestPath":
    "the declared plugin manifest path, asked by the plugin build",
  "src/contexts/tools/domain/plugins/native-plugins.ts :: NativePlugins.projectHooksDelivery":
    "the declared project hooks delivery, asked by the hooks installer",
  "src/contexts/tools/domain/plugins/native-plugins.ts :: NativePlugins.rootToken":
    "the declared plugin root token, substituted by the plugin build",
  "src/contexts/tools/domain/plugins/native-plugins.ts :: NativePlugins.trustNotice":
    "the declared hooks trust notice, collected by the plugin content translator into the install notices",
  "src/contexts/tools/domain/plugins/plugin-delivery.ts :: PluginDeliveryBase.globalFiles":
    "the declared global files, asked by the global install",
};

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
  );
}

/** What a class leaves readable in one source: each entry is a read a caller can make. */
function readableIn(file: string, source: string): string[] {
  const fields: string[] = [];
  for (const block of source.matchAll(CLASS_BLOCK)) {
    const body = block[2] as string;
    for (const pattern of [
      PUBLIC_FIELD,
      PARAMETER_PROPERTY,
      STORED_VALUE_GETTER,
      STORED_VALUE_METHOD,
      STORED_OBJECT_COPY,
    ]) {
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

/** What is readable and not allowed, then what is allowed and no longer readable. */
function verdictOn(readable: readonly string[], allowed: readonly string[]): string[] {
  return [
    ...readable.filter((entry) => !allowed.includes(entry)).map((entry) => `readable: ${entry}`),
    ...allowed.filter((entry) => !readable.includes(entry)).map((entry) => `stale: ${entry}`),
  ];
}

describe("a tool's plugin delivery is asked, never read", () => {
  it("no code outside the tools context reads a field of a plugins capability", () => {
    expect(readsOutsideTools([...sourceFiles(), ...testFiles()])).toEqual([]);
  });

  it("no capability or plugins class leaves a stored value readable", () => {
    expect(verdictOn(readableFields(), Object.keys(STORED_ANSWERS_ALLOWED))).toEqual([]);
  });

  it("reads every capability and plugins file, the activation and registration included", () => {
    const files = answeringFiles();
    expect(files).toContain("src/contexts/tools/domain/sections/config-section.ts");
    expect(files).toContain("src/contexts/tools/domain/plugins/native-plugins.ts");
    expect(files).toContain("src/contexts/tools/domain/native-registration/native-activation.ts");
    expect(files).toContain(
      "src/contexts/tools/domain/native-registration/marketplace-registration.ts"
    );
  });

  it("the shared base declares no answer only one way of taking plugins has", () => {
    const base = read("src/contexts/tools/domain/plugins/plugin-delivery.ts");
    expect(variantOnlyAnswersOn(base)).toEqual([]);
  });
});

/** Answers that belong to one variant alone; the base holds none of them. */
const VARIANT_ONLY = [
  "translatesAsMarketplace",
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
