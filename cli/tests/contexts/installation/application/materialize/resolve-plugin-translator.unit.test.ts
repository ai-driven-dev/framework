import { describe, expect, it } from "vitest";
import type { TranslatorDeps } from "../../../../../src/contexts/installation/application/materialize/plugin-translator-factory.js";
import { resolvePluginTranslator } from "../../../../../src/contexts/installation/application/materialize/resolve-plugin-translator.js";
import { fakeBuiltDeps } from "../../../../helpers/ports/fake-build-sources.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.js";

function deps(): TranslatorDeps {
  return {
    fs: new InMemoryFileAdapter(),
    built: fakeBuiltDeps(),
  };
}

describe("resolvePluginTranslator", () => {
  it("answers nothing for a tool that is not an AI tool", () => {
    expect(resolvePluginTranslator(registeredTools().profile(TOOL.vscode), deps())).toBeNull();
  });
});
