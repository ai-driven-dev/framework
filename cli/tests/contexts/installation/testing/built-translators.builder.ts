import { BuiltTreeMaterializationTranslator } from "../../../../src/contexts/installation/application/materialize/built-tree-materialization-translator.js";
import { ModeAMarketplaceTranslator } from "../../../../src/contexts/installation/application/materialize/mode-a-marketplace-translator.js";
import { ModeBFlatMaterializationTranslator } from "../../../../src/contexts/installation/application/materialize/mode-b-flat-materialization-translator.js";
import { ProjectHooksMaterializer } from "../../../../src/contexts/installation/application/materialize/project-hooks-materializer.use-case.js";
import type {
  BuiltBuildDeps,
  BuiltMaterializationDeps,
} from "../../../../src/contexts/installation/application/shared/built-materialization-deps.js";
import type { PluginTranslation } from "../../../../src/contexts/installation/ports/plugin/plugin-translation.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";

type Fs = FileReader & FileWriter;

/** The flat translator as composition wires it. */
export function modeBTranslator(
  fs: Fs,
  homedir: () => string,
  translate: PluginTranslation
): ModeBFlatMaterializationTranslator {
  return new ModeBFlatMaterializationTranslator(
    fs,
    homedir,
    translate,
    new ProjectHooksMaterializer(fs)
  );
}

/** The built-tree translator as composition wires it, falling back to the flat one. */
export function builtTreeTranslator(
  fs: Fs,
  build: BuiltBuildDeps
): BuiltTreeMaterializationTranslator {
  return new BuiltTreeMaterializationTranslator(
    fs,
    build,
    new ProjectHooksMaterializer(fs),
    modeBTranslator(fs, build.homedir, build.translate)
  );
}

/** The build sources a test fakes, with the translators composition builds over them. */
export function builtDepsOf(fs: Fs, build: BuiltBuildDeps): BuiltMaterializationDeps {
  return {
    ...build,
    translators: {
      builtTree: builtTreeTranslator(fs, build),
      marketplace: new ModeAMarketplaceTranslator(),
    },
  };
}
