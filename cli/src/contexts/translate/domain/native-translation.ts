import type { PluginDistribution } from "../../../shared/domain/plugin/plugin-distribution.js";
import type { ReadonlySkipList } from "../../../shared/domain/plugin/plugin-translation-skip.js";
import type {
  PluginInstallNotice,
  ReadonlyNoticeList,
} from "../../tools/contract/plugin-install-notice.js";
import type { NativePluginAnswers } from "../../tools/contract/tool-profile.js";
import { type TranslatedFile, translateFile } from "./component-translation.js";
import type { OutputFile } from "./output-file.js";
import { isComponentFile, isProse, makeFile } from "./plugin-paths.js";
import { withRootToken } from "./rules/root-token.js";
import type { TranslatedAiTool } from "./translate-profile.js";

/** A distribution translated for a tool that installs a plugin as a directory of its own. */
export interface NativeBuild {
  readonly dist: PluginDistribution;
  readonly tool: TranslatedAiTool;
  readonly plugins: NativePluginAnswers;
}

export function translateNativeWithPaths(
  build: NativeBuild,
  manifestPaths: readonly string[]
): {
  files: OutputFile[];
  componentPaths: ReadonlyMap<string, string>;
  skipped: ReadonlySkipList;
  notices: ReadonlyNoticeList;
} {
  const { dist, tool, plugins } = build;
  const pluginRoot = plugins.pluginOutputDir(dist.manifest.name);
  const { files, componentPaths } = buildNativeFiles(build, pluginRoot);
  const manifest = manifestFile(build, pluginRoot, manifestPaths);
  if (manifest !== null) files.push(manifest);
  const notices = collectHooksTrustNotices(dist, tool, plugins);
  return { files, componentPaths, skipped: [], notices };
}

function installedContent(
  relativePath: string,
  translated: TranslatedFile,
  { tool, plugins }: NativeBuild
): string {
  // Prose is rewritten, an artefact is carried byte for byte: a tool's own rewrite leaving
  // a script intact is luck rather than a guarantee.
  const rewritten = isProse(relativePath)
    ? tool.rewriteContent(translated.content)
    : translated.content;
  // The plugin-root variable is a path, not prose: a hook manifest and an mcp manifest both
  // name one, in JSON. Gating it on prose left every tool but Claude installing a hook that
  // points at a variable its own runtime never expands.
  return translated.verbatim === true ? rewritten : withRootToken(rewritten, plugins.rootToken());
}

function buildNativeFiles(
  build: NativeBuild,
  pluginRoot: string
): { files: OutputFile[]; componentPaths: ReadonlyMap<string, string> } {
  const result: OutputFile[] = [];
  const componentPaths = new Map<string, string>();
  for (const file of build.dist.files) {
    const translated = translateFile(file, build.tool, build.plugins);
    if (translated === null) continue;
    const installedPath = `${pluginRoot}${translated.relativePath}`;
    result.push(makeFile(installedPath, installedContent(file.relativePath, translated, build)));
    if (isComponentFile(file.relativePath)) componentPaths.set(installedPath, file.relativePath);
  }
  return { files: result, componentPaths };
}

function manifestFile(
  { dist, plugins }: NativeBuild,
  pluginRoot: string,
  manifestPaths: readonly string[]
): OutputFile | null {
  const manifestPath = plugins.manifestPath();
  if (manifestPath === null) return null;
  const sourceManifest = findSourceManifestContent(dist, manifestPaths);
  if (sourceManifest === null) return null;
  return makeFile(`${pluginRoot}${manifestPath}`, sourceManifest);
}

function findSourceManifestContent(
  dist: PluginDistribution,
  manifestPaths: readonly string[]
): string | null {
  for (const path of manifestPaths) {
    const file = dist.files.find((f) => f.relativePath === path);
    if (file !== undefined) return file.content;
  }
  return null;
}

// A delivered hook is not a skip: `hooksTrustNotice` names what a person still has to do
// before it runs, and only applies when this plugin actually ships one.
function collectHooksTrustNotices(
  dist: PluginDistribution,
  tool: TranslatedAiTool,
  plugins: NativePluginAnswers
): ReadonlyNoticeList {
  if (dist.components.hooks.length === 0) return [];
  const hooksTrustNotice = plugins.trustNotice();
  if (hooksTrustNotice === null) return [];
  const entry: PluginInstallNotice = {
    pluginName: dist.manifest.name,
    component: "hooks",
    toolId: tool.toolId,
    message: hooksTrustNotice,
  };
  return [entry];
}
