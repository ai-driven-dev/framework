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
 * a reader. The tools context owns the profile and `src/composition/` wires every context, so
 * neither is watched. The list below may only shrink.
 */
import { describe, expect, it } from "vitest";
import { expectRatchet, read, sourceFiles } from "./helpers.js";

const OWNER_OR_WIRING = /^src\/(contexts\/tools\/|composition\/)/;

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

function wholeProfileReaders(): string[] {
  return sourceFiles()
    .filter((file) => !OWNER_OR_WIRING.test(file))
    .filter((file) => namesWholeProfile(read(file)))
    .sort();
}

const TRANSLATE_HANDOFF =
  "hands the profile to the plugin translation pipeline, which translate's engine reads in full; it narrows when translate declares its own profile input";
const PRESENTATION_FILTER =
  "filters the catalog's whole profiles to the AI tools that activate at user scope with a type guard, then reads five members; presentation has no ports/ to name a section in";
const OUTSIDE_WAVE =
  "reads the profile for translation in full; not a reader the installation and host-registration narrowing reaches";

/** Shrink-only: a file that stops naming the whole profile leaves the list, and none joins it. */
const PROFILE_READERS_ALLOWED: Readonly<Record<string, string>> = {
  "src/contexts/installation/application/materialize/built-tree-materialization-translator.ts":
    TRANSLATE_HANDOFF,
  "src/contexts/installation/application/materialize/mode-b-flat-materialization-translator.ts":
    TRANSLATE_HANDOFF,
  "src/contexts/installation/application/materialize/plugin-translator.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/plugin/add-plugin.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/plugin/plugin-helpers.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/plugin/plugin-materializer.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/plugin/update-plugin.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/restore/apply-plugin-files.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/restore/restore-all-plugins.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/ports/plugin/plugin-translation.ts": TRANSLATE_HANDOFF,
  "src/contexts/translate/application/translate-plugin-distribution.ts": OUTSIDE_WAVE,
  "src/contexts/translate/domain/engine.ts": OUTSIDE_WAVE,
  "src/presentation/commands/setup.ts": PRESENTATION_FILTER,
};

describe("a reader names the sections of a tool it reads", () => {
  it("no file outside the tools context takes the whole profile but the ones listed", () => {
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
