/**
 * A reader outside the tools context names the sections of a tool it reads, never the whole
 * profile. The whole profile is a hundred members wide; a reader that takes it is coupled to all
 * of them, and a change to a section it never reads still reaches it. The narrow input is
 * declared where it is read (`ports/`), built from the answer types `tools/contract` publishes,
 * and composition hands in the real profile, which satisfies it by shape.
 *
 * The unit is the file that names `AiToolProfile`, `IdeToolProfile` or `ToolProfile`. Importing
 * the module for a section answer (`PluginAnswers`, `ConfigWrite`) is already narrow and is not
 * a reader. The tools context owns the profile and `src/composition/` wires every context, so
 * neither is watched. The list below may only shrink.
 */
import { describe, expect, it } from "vitest";
import { expectRatchet, read, sourceFiles } from "./helpers.js";

const OWNER_OR_WIRING = /^src\/(contexts\/tools\/|composition\/)/;

const WHOLE_PROFILE = "(?:AiToolProfile|IdeToolProfile|ToolProfile)";
const PROFILE_MODULE = String.raw`[^"']*tools/contract/tool-profile\.js`;
/** A named import from the profile module, on one line or many, `import type` or not. */
const NAMED_IMPORT = new RegExp(
  String.raw`import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']${PROFILE_MODULE}["']`,
  "g"
);
const WHOLE_NAME = new RegExp(String.raw`\b${WHOLE_PROFILE}\b`);
/** `import("…/tool-profile.js").ToolProfile`, which names the type without an import line. */
const INLINE_IMPORT = new RegExp(
  String.raw`import\(\s*["']${PROFILE_MODULE}["']\s*\)\s*\.\s*${WHOLE_PROFILE}\b`
);

function namesWholeProfile(text: string): boolean {
  for (const match of text.matchAll(NAMED_IMPORT)) {
    if (WHOLE_NAME.test(match[1] as string)) return true;
  }
  return INLINE_IMPORT.test(text);
}

function wholeProfileReaders(): string[] {
  return sourceFiles()
    .filter((file) => !OWNER_OR_WIRING.test(file))
    .filter((file) => namesWholeProfile(read(file)))
    .sort();
}

const NARROWS_IN_THIS_WAVE =
  "takes the whole profile but reads a few sections; it leaves the list when it names them in a port";
const TRANSLATE_HANDOFF =
  "hands the profile to the plugin translation pipeline, which translate's engine reads in full; it narrows when translate declares its own profile input";
const HOST_HANDOFF_AFTER_EDGE_WAVE =
  "hands the tool to a host-registration contract or port; it narrows once installation no longer reaches host-registration";
const OUTSIDE_WAVE =
  "reads the profile for translation or display in full; not a reader the installation and host-registration narrowing reaches";

/** Shrink-only: a file that stops naming the whole profile leaves the list, and none joins it. */
const PROFILE_READERS_ALLOWED: Readonly<Record<string, string>> = {
  "src/contexts/host-registration/application/host-marketplace-source-conflict.ts":
    NARROWS_IN_THIS_WAVE,
  "src/contexts/host-registration/application/inspect/inspect-declared-marketplaces.ts":
    NARROWS_IN_THIS_WAVE,
  "src/contexts/host-registration/application/native-host-registration-gate.ts":
    NARROWS_IN_THIS_WAVE,
  "src/contexts/host-registration/application/native-marketplace-source-proof.ts":
    NARROWS_IN_THIS_WAVE,
  "src/contexts/host-registration/application/read-marketplace-catalog-identity.ts":
    NARROWS_IN_THIS_WAVE,
  "src/contexts/host-registration/application/refresh-host-plugin.ts": NARROWS_IN_THIS_WAVE,
  "src/contexts/host-registration/application/register-plugin-with-host.ts": NARROWS_IN_THIS_WAVE,
  "src/contexts/installation/application/restore/generate-tool-distribution.ts":
    NARROWS_IN_THIS_WAVE,
  "src/contexts/installation/application/restore/restore-tool-files.ts": NARROWS_IN_THIS_WAVE,
  "src/contexts/installation/application/materialize/built-tree-materialization-translator.ts":
    TRANSLATE_HANDOFF,
  "src/contexts/installation/application/materialize/mode-b-flat-materialization-translator.ts":
    TRANSLATE_HANDOFF,
  "src/contexts/installation/application/materialize/plugin-translator.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/plugin/add-plugin.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/plugin/plugin-helpers.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/plugin/plugin-materializer.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/plugin/update-plugin.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/plugin/update-user-plugin-files.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/restore/apply-plugin-files.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/application/restore/restore-all-plugins.ts": TRANSLATE_HANDOFF,
  "src/contexts/installation/ports/plugin/plugin-translation.ts": TRANSLATE_HANDOFF,
  "src/contexts/host-registration/contract/withdrawal.ts": HOST_HANDOFF_AFTER_EDGE_WAVE,
  "src/contexts/installation/application/clean-project.ts": HOST_HANDOFF_AFTER_EDGE_WAVE,
  "src/contexts/installation/application/purge-user-scope-files.ts": HOST_HANDOFF_AFTER_EDGE_WAVE,
  "src/contexts/installation/application/removal/remove-plugin.ts": HOST_HANDOFF_AFTER_EDGE_WAVE,
  "src/contexts/installation/ports/native-host.ts": HOST_HANDOFF_AFTER_EDGE_WAVE,
  "src/contexts/translate/application/translate-distribution.ts": OUTSIDE_WAVE,
  "src/contexts/translate/domain/engine.ts": OUTSIDE_WAVE,
  "src/presentation/commands/setup.ts": OUTSIDE_WAVE,
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
});
