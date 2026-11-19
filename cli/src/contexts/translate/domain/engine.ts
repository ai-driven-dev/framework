import { parseFrontmatter, serializeFrontmatter } from "../../../shared/domain/markdown.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../shared/domain/plugin/plugin-distribution.js";
import type {
  PluginTranslationSkip,
  ReadonlySkipList,
} from "../../../shared/domain/plugin/plugin-translation-skip.js";
import type { FlatHooksBridge } from "../../tools/contract/build-contract.js";
import type {
  PluginInstallNotice,
  ReadonlyNoticeList,
} from "../../tools/contract/plugin-install-notice.js";
import { rewritePluginRootToken } from "../../tools/contract/plugin-root-token.js";
import type {
  AiToolProfile,
  FlatPluginAnswers,
  MarkdownSectionAnswers,
  NativePluginAnswers,
  PluginAnswers,
  SkillsSectionAnswers,
  ToolProfile,
} from "../../tools/contract/tool-profile.js";
import { flatHooksBridgeFile } from "./flat-layout.js";
import type { OutputFile } from "./output-file.js";

interface TranslatedFile {
  relativePath: string;
  content: string;
  /** An artefact, not prose: copied byte for byte, with no frontmatter round-trip and no path
   * rewriting. Codex's and Copilot's own rewrites change a bundled script by six and one bytes
   * respectively, which is a file that no longer parses. */
  verbatim?: true;
}

const PLUGIN_HOOKS_DIR = "hooks";
const MARKDOWN_EXTENSION = ".md";

function parentDirOf(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

// A hook script requires its siblings relative to itself, so the tree below hooks/ has to
// survive translation intact; flattening it breaks every such require.
function pathBelowHooks(path: string): string {
  return path.slice(PLUGIN_HOOKS_DIR.length + 1);
}

/** `manifestPaths` is every place a host keeps a plugin manifest, built once by composition from
 * the registered profiles. */
export function translate(
  dist: PluginDistribution,
  toolConfig: ToolProfile,
  manifestPaths: readonly string[]
): OutputFile[] {
  return translateWithComponentPaths(dist, toolConfig, manifestPaths).files;
}

export function translateWithComponentPaths(
  dist: PluginDistribution,
  toolConfig: ToolProfile,
  manifestPaths: readonly string[]
): {
  files: OutputFile[];
  componentPaths: ReadonlyMap<string, string>;
  skipped: ReadonlySkipList;
  notices: ReadonlyNoticeList;
} {
  const delivery = asPluginTool(toolConfig);
  if (delivery === null) return { files: [], componentPaths: new Map(), skipped: [], notices: [] };
  const { tool, plugins } = delivery;
  if (plugins.kind === "native")
    return translateNativeWithPaths(dist, tool, plugins, manifestPaths);
  if (plugins.kind === "flat") {
    const { files, skipped } = translateFlat(dist, tool, plugins);
    return { files, componentPaths: new Map(), skipped, notices: [] };
  }
  return { files: [], componentPaths: new Map(), skipped: [], notices: [] };
}

/** The hook paths a flat install writes for this plugin: its scripts and the generated bridge,
 * none for a tool that is not flat. */
export function flatHookPaths(
  dist: PluginDistribution,
  toolConfig: ToolProfile
): ReadonlySet<string> {
  const delivery = asPluginTool(toolConfig);
  if (delivery === null || delivery.plugins.kind !== "flat") return new Set();
  return new Set(flatHooksFiles(dist, delivery.plugins).map((file) => file.relativePath));
}

function translateNativeWithPaths(
  dist: PluginDistribution,
  tool: AiToolProfile,
  plugins: NativePluginAnswers,
  manifestPaths: readonly string[]
): {
  files: OutputFile[];
  componentPaths: ReadonlyMap<string, string>;
  skipped: ReadonlySkipList;
  notices: ReadonlyNoticeList;
} {
  const pluginRoot = plugins.pluginOutputDir(dist.manifest.name);
  const { files, componentPaths } = buildNativeFiles(dist, tool, plugins, pluginRoot);
  appendManifestFile(dist, plugins, pluginRoot, manifestPaths, files);
  const notices = collectHooksTrustNotices(dist, tool, plugins);
  return { files, componentPaths, skipped: [], notices };
}

function buildNativeFiles(
  dist: PluginDistribution,
  tool: AiToolProfile,
  plugins: NativePluginAnswers,
  pluginRoot: string
): { files: OutputFile[]; componentPaths: ReadonlyMap<string, string> } {
  const result: OutputFile[] = [];
  const componentPaths = new Map<string, string>();
  for (const file of dist.files) {
    const translated = translateFile(file, tool, plugins);
    if (translated === null) continue;
    // Prose is rewritten, an artefact is carried byte for byte: a tool's own rewrite leaving
    // a script intact is luck rather than a guarantee.
    const rewritten = isProse(file.relativePath)
      ? tool.rewriteContent(translated.content)
      : translated.content;
    // The plugin-root variable is a path, not prose: a hook manifest and an mcp manifest both
    // name one, in JSON. Gating it on prose left every tool but Claude installing a hook that
    // points at a variable its own runtime never expands.
    const content =
      translated.verbatim === true
        ? rewritten
        : rewritePluginRootToken(rewritten, plugins.rootToken());
    const installedPath = `${pluginRoot}${translated.relativePath}`;
    result.push(makeFile(installedPath, content));
    if (isComponentFile(file.relativePath)) componentPaths.set(installedPath, file.relativePath);
  }
  return { files: result, componentPaths };
}

function appendManifestFile(
  dist: PluginDistribution,
  plugins: NativePluginAnswers,
  pluginRoot: string,
  manifestPaths: readonly string[],
  result: OutputFile[]
): void {
  const manifestPath = plugins.manifestPath();
  if (manifestPath === null) return;
  const sourceManifest = findSourceManifestContent(dist, manifestPaths);
  if (sourceManifest === null) return;
  result.push(makeFile(`${pluginRoot}${manifestPath}`, sourceManifest));
}

// A delivered hook is not a skip: `hooksTrustNotice` names what a person still has to do
// before it runs, and only applies when this plugin actually ships one.
function collectHooksTrustNotices(
  dist: PluginDistribution,
  tool: AiToolProfile,
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

function translateFile(
  file: PluginComponentFile,
  tool: AiToolProfile,
  cap: NativePluginAnswers
): TranslatedFile | null {
  if (file.relativePath === ".mcp.json") {
    const mcp = cap.mcpFile();
    return mcp.accepts ? { relativePath: mcp.relativePath, content: file.content } : null;
  }
  if (file.relativePath.split("/")[0] === PLUGIN_HOOKS_DIR) {
    if (!cap.hooksAcceptance().accepts) return null;
    if (file.relativePath === `${PLUGIN_HOOKS_DIR}/hooks.json`) {
      return { relativePath: cap.hooksFilePath(), content: file.content };
    }
    // Everything under `hooks/` but its own manifest is a script the host runs. It goes beside
    // the manifest, and where the manifest sits at the plugin root it keeps its own directory
    //: a script at the root would leave the command naming `hooks/` pointing at nothing.
    const manifestDir = parentDirOf(cap.hooksFilePath()) || PLUGIN_HOOKS_DIR;
    return {
      relativePath: `${manifestDir}/${pathBelowHooks(file.relativePath)}`,
      content: cap.hookScript(file.relativePath, file.content),
      verbatim: true,
    };
  }
  return translateComponent(file, tool);
}

function translateComponent(file: PluginComponentFile, tool: AiToolProfile): TranslatedFile | null {
  const top = file.relativePath.split("/")[0];
  if (top === "commands" || top === "agents" || top === "rules") {
    const cap = tool.markdownSection(top);
    return cap === null ? null : translateMarkdown(file, `${top}/`, tool.directory, cap);
  }
  if (top === "skills") {
    const cap = tool.skillsSection();
    return cap === null ? null : translateSkill(file, cap);
  }
  return null;
}

function translateFlat(
  dist: PluginDistribution,
  tool: AiToolProfile,
  plugins: FlatPluginAnswers
): { files: OutputFile[]; skipped: ReadonlySkipList } {
  const { namespacePrefix: flatNamespacePrefix } = plugins.flatLayout();
  const result: OutputFile[] = [];
  for (const file of tool.markdownSection("commands") === null ? [] : dist.components.commands) {
    result.push(flatCommandFile(file, dist.manifest.name, tool, flatNamespacePrefix));
  }
  for (const section of ["agents", "rules", "skills"] as const) {
    for (const file of dist.components[section]) {
      const f = flatSectionFile(file, section, dist.manifest.name, tool);
      if (f !== null) result.push(f);
    }
  }
  result.push(...flatHooksFiles(dist, plugins));
  const skipped = collectHooksSkips(dist, tool, plugins);
  return { files: result, skipped };
}

// hooks/hooks.json is a manifest a merge reads, never a runtime module a loader scans for, so
// it is never delivered here. Everything else under hooks/ is carried verbatim, namespaced per
// plugin: unless it is that loader's own plugin module, delivered flat and renamed instead.
function flatHooksFiles(dist: PluginDistribution, plugins: FlatPluginAnswers): OutputFile[] {
  const { hooksBridge: flatHooksBridge } = plugins.flatLayout();
  const scripts = dist.components.hooks
    .filter((file) => file.relativePath !== `${PLUGIN_HOOKS_DIR}/hooks.json`)
    .flatMap((file) => {
      const path = plugins.hooksInstallPath(dist.manifest.name, file.relativePath);
      return path === null
        ? []
        : [makeFile(path, plugins.hookScript(file.relativePath, file.content))];
    });
  const bridge = installedHooksBridge(dist, flatHooksBridge);
  return bridge === null ? scripts : [...scripts, bridge];
}

// The install-time counterpart of the disk sink's own bridge write: `setup` and
// `plugin install` reach OpenCode through this translator, never through the disk sink,
// so without this a plugin's hooks trigger only on a tree `translate` produced.
function installedHooksBridge(
  dist: PluginDistribution,
  bridge: FlatHooksBridge | null
): OutputFile | null {
  if (bridge === null) return null;
  const manifestFile = dist.components.hooks.find(
    (f) => f.relativePath === `${PLUGIN_HOOKS_DIR}/hooks.json`
  );
  if (manifestFile === undefined) return null;
  const hasOwnBridge = dist.components.hooks.some(
    (f) => basename(f.relativePath) === bridge.skipIfSourceHas
  );
  const file = flatHooksBridgeFile(bridge, manifestFile.content, dist.manifest.name, hasOwnBridge);
  return file === null ? null : makeFile(file.relativePath, file.content);
}

function collectHooksSkips(
  dist: PluginDistribution,
  tool: AiToolProfile,
  plugins: PluginAnswers
): ReadonlySkipList {
  if (dist.components.hooks.length === 0) return [];
  const acceptance = plugins.hooksAcceptance();
  if (acceptance.accepts) return [];
  const entry: PluginTranslationSkip = {
    pluginName: dist.manifest.name,
    component: "hooks",
    toolId: tool.toolId,
    reason: acceptance.reason,
  };
  return [entry];
}

function flatCommandFile(
  file: PluginComponentFile,
  pluginName: string,
  tool: AiToolProfile,
  prefix: string
): OutputFile {
  const filename = basename(file.relativePath);
  const raw = prefixCommandName(file.content, file.relativePath, prefix, pluginName);
  const content = tool.rewriteContent(raw);
  return makeFile(tool.flatInstallPath("commands", pluginName, filename), content);
}

function flatSectionFile(
  file: PluginComponentFile,
  section: "agents" | "rules" | "skills",
  pluginName: string,
  tool: AiToolProfile
): OutputFile | null {
  const sectionDir = `${section}/`;
  const fileName = file.relativePath.slice(sectionDir.length);
  if (!sectionDeclared(tool, section)) {
    const artifact =
      section === "agents" ? tool.buildContract("flat")?.artifacts.agents : undefined;
    if (!artifact?.supported || !isProse(file.relativePath)) return null;
    const content = tool.rewriteContent(file.content);
    return makeFile(
      artifact.path(pluginName, file.relativePath),
      artifact.transform?.(content, pluginName, fileName) ?? content
    );
  }
  // Same rule as the native path: prose is rewritten, an artefact is carried. Rewriting every
  // flat file left a script intact only where a tool's own rewrite happened to spare it.
  const content = isProse(file.relativePath) ? tool.rewriteContent(file.content) : file.content;
  if (section === "agents") {
    const artifact = tool.buildContract("flat")?.artifacts.agents;
    if (artifact?.supported) {
      return makeFile(
        artifact.path(pluginName, file.relativePath),
        artifact.transform?.(content, pluginName, fileName) ?? content
      );
    }
  }
  return makeFile(tool.flatInstallPath(section, pluginName, fileName), content);
}

function makeFile(relativePath: string, content: string): OutputFile {
  return { relativePath, content };
}

function asPluginTool(
  profile: ToolProfile
): { tool: AiToolProfile; plugins: PluginAnswers } | null {
  if (profile.kind !== "ai") return null;
  const plugins = profile.plugins();
  return plugins === null ? null : { tool: profile, plugins };
}

function sectionDeclared(tool: AiToolProfile, section: "agents" | "rules" | "skills"): boolean {
  return section === "skills"
    ? tool.skillsSection() !== null
    : tool.markdownSection(section) !== null;
}

/** Prose is translated; anything else a plugin ships is an artefact, carried byte for byte. The
 * extension is the whole test: a plugin's components are markdown by definition. */
function isProse(relativePath: string): boolean {
  return relativePath.endsWith(MARKDOWN_EXTENSION);
}

function isComponentFile(relativePath: string): boolean {
  const top = relativePath.split("/")[0];
  return top === "agents" || top === "commands" || top === "rules" || top === "skills";
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

function basename(relativePath: string): string {
  return relativePath.split("/").at(-1) ?? relativePath;
}

function prefixCommandName(
  content: string,
  relativePath: string,
  prefix: string,
  pluginName: string
): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const rawName = typeof frontmatter.name === "string" ? frontmatter.name : "";
  const simpleName = stripCommandPrefix(rawName) || basename(relativePath);
  const newFrontmatter = { ...frontmatter, name: `${prefix}${pluginName}:${simpleName}` };
  return serializeFrontmatter(newFrontmatter, body);
}

function stripCommandPrefix(name: string): string {
  const match = /^aidd:\d+:(.+)$/.exec(name);
  if (match) return match[1];
  return name.slice(name.lastIndexOf(":") + 1);
}

function toPluginRelativePath(fullPath: string, toolDirectory: string): string {
  const relative = fullPath.startsWith(toolDirectory)
    ? fullPath.slice(toolDirectory.length)
    : fullPath;
  return relative.replace(/^([^/]+)\/aidd\//, "$1/");
}

function translateMarkdown(
  file: PluginComponentFile,
  sectionDir: string,
  toolDirectory: string,
  cap: MarkdownSectionAnswers
): TranslatedFile | null {
  const fileName = file.relativePath.slice(sectionDir.length);
  const fullPath = cap.buildInstallPath(fileName);
  if (fullPath === null) return null;
  const relativePath = toPluginRelativePath(fullPath, toolDirectory);
  const { frontmatter, body } = parseFrontmatter(file.content);
  const newFm = cap.convertFrontmatter(frontmatter, fileName);
  const content = cap.serialize(newFm, body);
  return { relativePath, content };
}

/** A skill is prose with frontmatter; anything else under `skills/` is an asset the skill
 * carries. A frontmatter round-trip and a path rewrite are meaningless for a file that is not
 * prose, and both can damage it. */
function translateSkill(file: PluginComponentFile, cap: SkillsSectionAnswers): TranslatedFile {
  if (!isProse(file.relativePath)) {
    return { relativePath: file.relativePath, content: file.content, verbatim: true };
  }
  const { frontmatter, body } = parseFrontmatter(file.content);
  const newFm = cap.convertFrontmatter(frontmatter);
  const content = cap.serialize(newFm, body);
  return { relativePath: file.relativePath, content };
}
