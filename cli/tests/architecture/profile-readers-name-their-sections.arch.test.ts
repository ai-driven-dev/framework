/**
 * A reader outside the tools context names the sections of a tool it reads, never the whole
 * profile. The whole profile is about thirty members wide; a reader that takes it is coupled to all
 * of them, and a change to a section it never reads still reaches it. The narrow input is
 * declared where it is read (`ports/`), built from the answer types `tools/contract` publishes,
 * and composition hands in the real profile, which satisfies it by shape.
 *
 * The unit is the file that names `AiToolProfile`, `IdeToolProfile` or `ToolProfile`, by import,
 * re-export, namespace import, or the catalog's whole-profile methods typed by index. Importing
 * the module for a section answer (`PluginAnswers`, `ConfigWrite`) is already narrow and is not
 * a reader. A file that never names the whole profile is still one when it asks the catalog for a
 * profile and passes it into a parameter typed as the whole profile: `profile-flow.ts` reads that
 * from the compiler, over the files that call a whole-profile catalog method, and leaves out a
 * call whose callee is declared in a listed file, which already carries that debt. The tools
 * context owns the profile and `src/composition/` wires every context, so neither is watched.
 * The list below may only shrink.
 */
import { describe, expect, it } from "vitest";
import { CLI_ROOT, expectRatchet, read, sourceFiles } from "./helpers.js";
import { wholeProfileFlows, wholeProfileFlowsInSources } from "./profile-flow.js";

const OWNER_OR_WIRING = /^src\/(contexts\/tools\/|composition\/)/;

const PROFILE_MODULE_FILE = "src/contexts/tools/contract/tool-profile.ts";
const WHOLE_PROFILE = "(?:AiToolProfile|IdeToolProfile|ToolProfile)";
const PROFILE_MODULE = String.raw`[^"']*tools/contract/tool-profile\.js`;
/** A named import or re-export from the profile module, on one line or many, `type` or not. */
const NAMED_IMPORT = new RegExp(
  String.raw`(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']${PROFILE_MODULE}["']`,
  "g"
);
const WHOLE_NAME = new RegExp(String.raw`\b${WHOLE_PROFILE}\b`);
/** `import("…/tool-profile.js").ToolProfile`, which names the type without an import line. */
const INLINE_IMPORT = new RegExp(
  String.raw`import\(\s*["']${PROFILE_MODULE}["']\s*\)\s*\.\s*${WHOLE_PROFILE}\b`
);
/** A namespace import reaches every member, the whole profile among them. */
const NAMESPACE_IMPORT = new RegExp(
  String.raw`(?:import|export)\s+(?:type\s+)?\*\s+(?:as\s+\w+\s+)?from\s+["']${PROFILE_MODULE}["']`
);
/** The catalog methods that answer a whole profile; `ToolCatalog["aiProfile"]` types it without
 * naming the profile. */
const CATALOG_PROFILE_METHODS = [
  "profile",
  "aiProfile",
  "ideProfile",
  "aiProfileIfAny",
  "sortedById",
];
const CATALOG_INDEXED_ACCESS = new RegExp(
  String.raw`\bToolCatalog\s*\[\s*["'](?:${CATALOG_PROFILE_METHODS.join("|")})["']\s*\]`
);

function namesWholeProfile(text: string): boolean {
  for (const match of text.matchAll(NAMED_IMPORT)) {
    if (WHOLE_NAME.test(match[1] ?? "")) return true;
  }
  return (
    INLINE_IMPORT.test(text) || NAMESPACE_IMPORT.test(text) || CATALOG_INDEXED_ACCESS.test(text)
  );
}

const CATALOG_PROFILE_CALL = new RegExp(String.raw`\.(?:${CATALOG_PROFILE_METHODS.join("|")})\(`);

function wholeProfileReaders(): string[] {
  const watched = sourceFiles().filter((file) => !OWNER_OR_WIRING.test(file));
  const flowing = wholeProfileFlows(
    CLI_ROOT,
    PROFILE_MODULE_FILE,
    watched.filter((file) => CATALOG_PROFILE_CALL.test(read(file))),
    Object.keys(PROFILE_READERS_ALLOWED)
  );
  return [
    ...new Set([...watched.filter((file) => namesWholeProfile(read(file))), ...flowing]),
  ].sort();
}

const TRANSLATE_HANDOFF =
  "hands the profile to the plugin translation pipeline, which translate's engine reads in full; it narrows when translate declares its own profile input";
const PRESENTATION_FILTER =
  "filters the catalog's whole profiles to the AI tools that activate at user scope with a type guard, then reads five members; presentation has no ports/ to name a section in";
const OUTSIDE_WAVE =
  "reads the profile for translation in full; not a reader the installation and host-registration narrowing reaches";

/** Shrink-only: a file that stops naming the whole profile leaves the list. */
const PROFILE_READERS_ALLOWED: Readonly<Record<string, string>> = {
  "src/contexts/installation/application/materialize/built-tree-materialization-translator.ts":
    TRANSLATE_HANDOFF,
  "src/contexts/installation/application/materialize/mode-b-flat-materialization-translator.ts":
    TRANSLATE_HANDOFF,
  "src/contexts/installation/application/materialize/plugin-translator.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/materialize/replace-plugin-files.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/plugin/add-plugin.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/plugin/plugin-helpers.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/plugin/plugin-materializer.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/restore/apply-plugin-files.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/restore/restore-all-plugins.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/ports/plugin/plugin-translation.ts": TRANSLATE_HANDOFF,
  "src/contexts/translate/application/translate-plugin-distribution.ts": OUTSIDE_WAVE,
  "src/contexts/translate/domain/engine.ts": OUTSIDE_WAVE,
  "src/presentation/commands/setup.ts": PRESENTATION_FILTER,
};

/**
 * The flow reading starts a compiler process and checks the project: measured 0.3s alone, 0.7s in
 * the architecture batch and up to 3.3s with other suites running, so the 5s default has little
 * room under load.
 */
const FLOW_TIMEOUT_MS = 30_000;

describe("a reader names the sections of a tool it reads", () => {
  it("no file outside the tools context takes the whole profile but the ones listed", {
    timeout: FLOW_TIMEOUT_MS,
  }, () => {
    const { added, fixed } = expectRatchet(
      wholeProfileReaders(),
      Object.keys(PROFILE_READERS_ALLOWED)
    );
    expect({
      added: added.map((file) => `${file}: name the sections it reads, in its own ports/`),
      fixed: fixed.map((file) => `${file}: remove it from PROFILE_READERS_ALLOWED`),
    }).toEqual({ added: [], fixed: [] });
  });

  it("the guard itself: sees a multi-line import and an inline import, not a section-only one", () => {
    const multiLine = `import type {\n  PluginAnswers,\n  AiToolProfile,\n} from "../../tools/contract/tool-profile.js";`;
    const inline = `type T = import("../tools/contract/tool-profile.js").ToolProfile;`;
    const sectionOnly = `import type { PluginAnswers, ConfigWrite } from "../../tools/contract/tool-profile.js";`;
    expect(namesWholeProfile(multiLine)).toBe(true);
    expect(namesWholeProfile(inline)).toBe(true);
    expect(namesWholeProfile(sectionOnly)).toBe(false);
  });

  it("the guard itself: sees a re-export, a namespace import and the catalog's whole-profile methods", () => {
    const reExport = `export type { PluginAnswers, AiToolProfile } from "../tools/contract/tool-profile.js";`;
    const namespace = `import type * as Profile from "../tools/contract/tool-profile.js";`;
    const returned = `type T = NonNullable<ReturnType<ToolCatalog["aiProfile"]>>;`;
    const listed = `type T = ReturnType<ToolCatalog['sortedById']>[number];`;
    const sectionReExport = `export type { PluginAnswers } from "../tools/contract/tool-profile.js";`;
    const idOnly = `type T = ReturnType<ToolCatalog["toolId"]>;`;
    expect(namesWholeProfile(reExport)).toBe(true);
    expect(namesWholeProfile(namespace)).toBe(true);
    expect(namesWholeProfile(returned)).toBe(true);
    expect(namesWholeProfile(listed)).toBe(true);
    expect(namesWholeProfile(sectionReExport)).toBe(false);
    expect(namesWholeProfile(idOnly)).toBe(false);
  });

  it("the guard itself: lists every catalog method that answers a whole profile", () => {
    const answering = [
      ...read("src/contexts/tools/contract/tool-catalog.ts").matchAll(
        /^\s+(\w+)\([^)]*\):[^;]*\b(?:Ai|Ide)?ToolProfile\b/gm
      ),
    ].map((match) => match[1]);
    expect([...new Set(answering)].sort()).toEqual([...CATALOG_PROFILE_METHODS].sort());
  });
});

describe("the flow guard itself", () => {
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
