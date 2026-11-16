/**
 * `translate` learns where a host keeps its plugin manifest from the tool catalog
 * (`pluginManifestProbes`), never from a list of its own. The one literal it may hold is the
 * canonical source manifest, `SOURCE_PLUGIN_MANIFEST_RELATIVE`. A second spelling of another
 * host's path would be a list that drifts from the profiles.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./helpers.js";

const MANIFEST_LITERAL = /["'][^"'\n]*plugin\.json["']/g;
const SOURCE_SPELLING = "src/contexts/translate/domain/canon-format.ts";

function manifestLiterals(files: readonly string[]): string[] {
  return files.flatMap((file) =>
    (read(file).match(MANIFEST_LITERAL) ?? []).map((literal) => `${file} :: ${literal}`)
  );
}

describe("translate holds no list of the other hosts' manifest paths", () => {
  it("spells a plugin manifest path only as the canonical source's", () => {
    const files = sourceFiles().filter(
      (file) => file.startsWith("src/contexts/translate/") && file !== SOURCE_SPELLING
    );

    expect(manifestLiterals(files)).toEqual([]);
  });

  it("sees a host manifest path written into a translate file", () => {
    const planted = 'const PATHS = [".cursor-plugin/plugin.json"];';

    expect(planted.match(MANIFEST_LITERAL)).toEqual(['".cursor-plugin/plugin.json"']);
  });
});
