import { BuiltTreeMaterializationTranslator } from "../../../../src/contexts/installation/application/materialize/built-tree-materialization-translator.js";
import { ModeBFlatMaterializationTranslator } from "../../../../src/contexts/installation/application/materialize/mode-b-flat-materialization-translator.js";
import { ProjectHooksMaterializer } from "../../../../src/contexts/installation/application/materialize/project-hooks-materializer.use-case.js";
import type { BuiltBuildDeps } from "../../../../src/contexts/installation/application/shared/built-materialization-deps.js";
import type { PluginTranslation } from "../../../../src/contexts/installation/ports/plugin/plugin-translation.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";

type Fs = FileReader & FileWriter;

/** The flat translator over the real project hooks. */
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

/** The built-tree translator over the real project hooks, falling back to the flat one. */
export function builtTreeTranslator(
  fs: Fs,
  build: BuiltBuildDeps
): BuiltTreeMaterializationTranslator {
  const projectHooks = new ProjectHooksMaterializer(fs);
  const flat = new ModeBFlatMaterializationTranslator(
    fs,
    build.homedir,
    build.translate,
    projectHooks
  );
  return new BuiltTreeMaterializationTranslator(fs, build, projectHooks, flat);
}
