import { cp, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOutput } from "../../../src/composition/shared.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import type { HooksDescriptor } from "../../../src/contexts/tools/domain/formats/hooks/descriptor.js";
import { claude } from "../../../src/contexts/tools/domain/profiles/claude/claude.profile.js";
import { codexProfile } from "../../../src/contexts/tools/domain/profiles/codex/codex.profile.js";
import { copilot } from "../../../src/contexts/tools/domain/profiles/copilot/copilot.profile.js";
import { cursor } from "../../../src/contexts/tools/domain/profiles/cursor/cursor.profile.js";
import { kilo } from "../../../src/contexts/tools/domain/profiles/kilo/kilo.profile.js";
import { opencode } from "../../../src/contexts/tools/domain/profiles/opencode/opencode.profile.js";
import { SmolTomlCodec } from "../../../src/contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { render } from "../../../src/presentation/errors/error-translator.presenter.js";
import type { AiToolId } from "../../../src/shared/domain/tool.js";
import { catalogOf } from "../../shared/testing/catalog-of.builder.js";
import { pathWithoutAidd } from "../../shared/testing/cli-sandbox.builder.js";
import { present } from "../../shared/testing/present.builder.js";
import { REPOSITORY_ROOT } from "../../shared/testing/repository-root.builder.js";

/**
 * Every route that writes or removes a tool's hook files, driven through the same use cases
 * the commands call, against the real aidd-context and aidd-telemetry plugins. The expected
 * output of each tool and route is a file under tests/fixtures/hooks-routes/.
 */

// A worker thread's `process.env` never reaches the native `os.homedir()` (a mutation run uses
// threads), so every route would share one profile and see the previous test's user-scope files.
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => process.env.HOME ?? actual.homedir() };
});

const PLUGINS = ["aidd-context", "aidd-telemetry"] as const;
const FIXTURES = join(import.meta.dirname, "..", "..", "fixtures", "hooks-routes");

type Route =
  | "native-build"
  | "flat-translate"
  | "plugin-install"
  | "plugin-install-twice"
  | "setup-plugins-reinstall"
  | "plugin-remove"
  | "clean";

const ROUTES: readonly Route[] = [
  "native-build",
  "flat-translate",
  "plugin-install",
  "plugin-install-twice",
  "setup-plugins-reinstall",
  "plugin-remove",
  "clean",
];

const CONFIG_FILES = new Set(["settings.json", "config.toml", "opencode.json", "kilo.jsonc"]);

interface Workspace {
  readonly root: string;
  readonly project: string;
  readonly home: string;
  readonly source: string;
}

const created: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function workspace(): Promise<Workspace> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "aidd-hooks-routes-")));
  created.push(root);
  const project = join(root, "project");
  const home = join(root, "home");
  const source = join(root, "source");
  await mkdir(project, { recursive: true });
  await mkdir(home, { recursive: true });
  vi.stubEnv("HOME", home);
  vi.stubEnv("USERPROFILE", home);
  vi.stubEnv("XDG_CONFIG_HOME", join(home, ".config"));
  vi.stubEnv("AIDD_USER_CONFIG_DIR", join(home, ".config", "aidd"));
  vi.stubEnv("CODEX_HOME", join(home, ".codex"));
  vi.stubEnv("PATH", pathWithoutAidd());
  return { root, project, home, source };
}

async function writeSource(source: string): Promise<void> {
  await mkdir(join(source, ".claude-plugin"), { recursive: true });
  for (const plugin of PLUGINS) {
    await cp(join(REPOSITORY_ROOT, "plugins", plugin), join(source, "plugins", plugin), {
      recursive: true,
    });
  }
  await writeFile(
    join(source, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "aidd-framework",
      version: "0.1.0",
      description: "Hook routes",
      owner: { name: "Test" },
      plugins: PLUGINS.map((name) => ({ name, source: `./plugins/${name}`, strict: true })),
    })
  );
}

type Deps = Awaited<ReturnType<typeof deps>>;

async function deps(project: string) {
  const { bindContainer } = await import("../../../src/composition/orchestration/deps-graph.js");
  return bindContainer(catalogOf())(project, { verbose: false }, createOutput(false));
}

async function installTool(project: string, toolId: AiToolId): Promise<void> {
  const wired = await deps(project);
  const { InitProject } = await import(
    "../../../src/contexts/installation/application/init-project.js"
  );
  await new InitProject(
    {
      fs: wired.fs,
      manifestRepo: wired.manifestRepo,
      updateGitignore: new UpdateGitignore(wired.fs),
    },
    catalogOf()
  ).execute({
    projectRoot: project,
  });
  const install = { tools: catalogOf(), toolId, force: false, version: "1.0.0" };
  await wired.installAiToolUseCase.execute({
    ...install,
    projectRoot: project,
    propagatePlugins: false,
  });
}

async function installPlugin(project: string, toolId: AiToolId, plugin: string): Promise<void> {
  const wired = await deps(project);
  const pluginArg = join(REPOSITORY_ROOT, "plugins", plugin);
  const install = { pluginArg, toolIds: [toolId], tools: catalogOf(), interactive: false };
  await wired.pluginInstallUseCase.execute({ ...install, projectRoot: project, yes: true });
}

async function build(
  ws: Workspace,
  toolId: AiToolId,
  mode: "marketplace" | "flat"
): Promise<string | null> {
  const { createFrameworkBuildUseCase } = await import("../../../src/composition/translate.js");
  const wired = await deps(ws.project);
  const out = join(ws.root, `out-${mode}`);
  await mkdir(out, { recursive: true });
  const useCase = createFrameworkBuildUseCase(catalogOf(), wired, {
    target: toolId,
    mode,
    outDir: out,
    force: false,
  });
  if (useCase === undefined) return null;
  await writeSource(ws.source);
  await useCase.execute({ sourceDir: ws.source, outDir: out, target: toolId, mode });
  return out;
}

async function walk(dir: string, found: string[] = []): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, found);
    else found.push(path);
  }
  return found;
}

function isHookFile(rel: string): boolean {
  if (/(^|\/)(skills|agents|commands|rules|prompts|instructions)\//.test(rel)) return false;
  if (rel.startsWith(".aidd/") || basename(rel) === "manifest.json") return false;
  if (/hook/i.test(rel)) return true;
  return CONFIG_FILES.has(basename(rel)) || basename(rel) === "plugin.json";
}

async function sourceHookScripts(): Promise<Map<string, string>> {
  const scripts = new Map<string, string>();
  for (const plugin of PLUGINS) {
    const dir = join(REPOSITORY_ROOT, "plugins", plugin, "hooks");
    for (const file of await walk(dir)) {
      const key = `${plugin}/${relative(dir, file).split(sep).join("/")}`;
      scripts.set(key, await readFile(file, "utf8"));
    }
  }
  return scripts;
}

const ADAPTERS = join(import.meta.dirname, "..", "..", "..", "assets", "hooks-runtime");

const DESCRIPTORS: Readonly<Record<string, HooksDescriptor>> = {
  claude: present(claude.hooks),
  codex: present(codexProfile(new SmolTomlCodec()).hooks),
  copilot: present(copilot.hooks),
  cursor: present(cursor.hooks),
  opencode: present(opencode.hooks),
  kilo: present(kilo.hooks),
};

/** Each tool's host adapter by content, so a delivered copy names the one it is: an asset file
 * shipped as is, or the text a descriptor stamps from one, named for its tool. */
async function hostAdapters(): Promise<Map<string, string>> {
  const adapters = new Map<string, string>();
  for (const file of await readdir(ADAPTERS)) {
    adapters.set(await readFile(join(ADAPTERS, file), "utf8"), file);
  }
  for (const [tool, descriptor] of Object.entries(DESCRIPTORS)) {
    const adapter = descriptor.runtime?.adapter;
    if (adapter !== undefined && !adapters.has(adapter)) adapters.set(adapter, `for ${tool}`);
  }
  return adapters;
}

function normalize(text: string, ws: Workspace): string {
  return text
    .split(ws.root)
    .join("<root>")
    .split(REPOSITORY_ROOT)
    .join("<repo>")
    .replace(/"version": "[^"]*"/g, '"version": "<version>"');
}

/** A plugin descriptor carries much besides hooks; only its hooks reference is route output. */
function hooksOfDescriptor(content: string): string | null {
  const hooks = (JSON.parse(content) as { hooks?: unknown }).hooks;
  return hooks === undefined ? null : JSON.stringify({ hooks }, null, 2);
}

function byRelativePath(a: { rel: string }, b: { rel: string }): number {
  if (a.rel === b.rel) return 0;
  return a.rel < b.rel ? -1 : 1;
}

interface HookSources {
  readonly scripts: ReadonlyMap<string, string>;
  readonly adapters: ReadonlyMap<string, string>;
}

/** The plugin script a delivered file was copied from, by the path it arrives under. */
function pluginScriptOf(scripts: ReadonlyMap<string, string>, rel: string): string | undefined {
  const origin = [...scripts].find(([key]) => {
    const [plugin, ...rest] = key.split("/");
    return /\.c?js$/.test(rel) && rel.includes(`${plugin}/`) && rel.endsWith(`/${rest.join("/")}`);
  });
  return origin?.[1];
}

/** One delivered hook file as the snapshot shows it, or `null` for a descriptor with no hooks. */
async function hookFileSection(
  { label, rel, file }: { label: string; rel: string; file: string },
  sources: HookSources,
  ws: Workspace
): Promise<string | null> {
  const content = await readFile(file, "utf8");
  const shown = `${label}/${rel}`;
  const adapter = basename(rel) === "host.cjs" ? sources.adapters.get(content) : undefined;
  if (adapter !== undefined) {
    return `## ${shown}\nscript, identical to the host adapter ${adapter}\n`;
  }
  const origin = pluginScriptOf(sources.scripts, rel);
  if (origin !== undefined) {
    const verdict = origin === content ? "identical to" : "differs from";
    return `## ${shown}\nscript, ${verdict} the plugin source\n`;
  }
  const shownContent = basename(rel) === "plugin.json" ? hooksOfDescriptor(content) : content;
  return shownContent === null ? null : `## ${shown}\n${normalize(shownContent, ws)}\n`;
}

/**
 * Hook scripts are plugin content, not route output: they are pinned by path and by whether
 * they arrive byte for byte. Everything a route composes (config, bridges, descriptors'
 * hooks reference) is pinned in full.
 */
async function describeHookFiles(ws: Workspace, bases: readonly string[]): Promise<string> {
  const sources = { scripts: await sourceHookScripts(), adapters: await hostAdapters() };
  const sections: string[] = [];
  for (const base of bases) {
    const label = relative(ws.root, base).split(sep).join("/");
    const found = (await walk(base)).map((file) => ({
      file,
      rel: relative(base, file).split(sep).join("/"),
    }));
    const hookFiles = found.sort(byRelativePath).filter(({ rel }) => isHookFile(rel));
    for (const { file, rel } of hookFiles) {
      const section = await hookFileSection({ label, rel, file }, sources, ws);
      if (section !== null) sections.push(section);
    }
  }
  return sections.length === 0 ? "no hook file\n" : sections.join("\n");
}

type RecordedManifest = NonNullable<Awaited<ReturnType<Deps["manifestRepo"]["load"]>>>;

type RecordedPlugin = ReturnType<RecordedManifest["getPlugins"]>[number];

function recordedPluginLines(
  ws: Workspace,
  header: { scope: string; toolId: string },
  plugin: RecordedPlugin
): string[] {
  const hookFiles = [...plugin.files.keys()]
    .filter((f) => /hook/i.test(f) && !f.includes("/skills/"))
    .sort();
  const projectHooks = JSON.stringify(plugin.projectHooks ?? null, null, 2);
  const dependents = plugin.dependents.map(
    (dependent) => `<root>/${relative(ws.root, dependent).split(sep).join("/")}`
  );
  return [
    `${header.scope} ${header.toolId} ${plugin.name} scope=${plugin.scope}: ${hookFiles.length} hook files`,
    ...hookFiles.map((f) => `  ${f}`),
    `  projectHooks ${projectHooks}`,
    `  dependents ${JSON.stringify(dependents)}`,
  ];
}

async function recordedPlugins(
  ws: Workspace,
  manifest: RecordedManifest | null,
  scope: string
): Promise<string[]> {
  if (manifest === null) return [`${scope}: no manifest`];
  const lines: string[] = [];
  for (const toolId of manifest.getInstalledToolIds()) {
    for (const plugin of manifest.getPlugins(toolId)) {
      lines.push(...recordedPluginLines(ws, { scope, toolId }, plugin));
    }
    const registrations = manifest.getNativeRegistrations(toolId);
    lines.push(
      `${scope} ${toolId} nativeRegistrations pluginRefs ${JSON.stringify(registrations?.pluginRefs ?? null)}`
    );
  }
  return lines.length === 0 ? [`${scope}: no plugin recorded`] : lines;
}

async function pluginsRecorded(ws: Workspace): Promise<string> {
  const wired = await deps(ws.project);
  const lines = [
    ...(await recordedPlugins(ws, await wired.manifestRepo.load(), "project")),
    ...(await recordedPlugins(ws, await wired.userManifestRepo.load(), "machine")),
  ];
  return `${normalize(lines.join("\n"), ws)}\n`;
}

/**
 * `aidd setup --plugins <names>` is the route that reinstalls: ChoosePlugins asks
 * for `replace: true`, so an existing plugin's entries are dropped and added again. The plugins
 * are installed from a marketplace first, as setup does, then setup runs over them.
 */
async function reinstallThroughSetup(ws: Workspace): Promise<string> {
  await writeSource(ws.source);
  const wired = await deps(ws.project);
  await wired.addMarketplace.execute({
    source: { kind: "local", path: ws.source },
    name: "hooks-routes",
    scope: "project",
    projectRoot: ws.project,
    autoTrust: true,
  });
  const options = {
    projectRoot: ws.project,
    mode: "named",
    pluginNames: [...PLUGINS],
    interactive: false,
    tools: catalogOf(),
  } as const;
  await wired.choosePlugins.execute(options);
  const before = await describeHookFiles(ws, [ws.project, ws.home]);
  let outcome = "setup over installed plugins resolved";
  try {
    await wired.choosePlugins.execute(options);
  } catch (error) {
    outcome = `setup over installed plugins threw ${(error as Error).constructor.name}: ${normalize(render(error), ws)}`;
  }
  const after = await describeHookFiles(ws, [ws.project, ws.home]);
  if (!/^## .*hook/im.test(after))
    return `${outcome}\nno hook file written without the host binary`;
  return `${outcome}\nhook files unchanged by the second run: ${before === after}`;
}

async function recordedReport(ws: Workspace, bases: readonly string[]): Promise<string> {
  return `${await describeHookFiles(ws, bases)}\n# recorded\n${await pluginsRecorded(ws)}`;
}

async function secondInstall(ws: Workspace, toolId: AiToolId): Promise<string> {
  try {
    await installPlugin(ws.project, toolId, "aidd-context");
    return "second install resolved";
  } catch (error) {
    return `second install threw ${(error as Error).constructor.name}: ${normalize(render(error), ws)}`;
  }
}

/** The routes that start from the tool and the two plugins installed in a project. */
async function runOnInstalled(ws: Workspace, route: Route, toolId: AiToolId): Promise<string> {
  const bases = [ws.project, ws.home];
  if (route === "plugin-install") return recordedReport(ws, bases);
  if (route === "plugin-install-twice") {
    return `${await secondInstall(ws, toolId)}\n\n${await recordedReport(ws, bases)}`;
  }
  const wired = await deps(ws.project);
  if (route === "plugin-remove") {
    const removal = { pluginName: "aidd-context", toolIds: [toolId] };
    await wired.pluginRemoveUseCase.execute({ ...removal, projectRoot: ws.project });
    return recordedReport(ws, bases);
  }
  const clean = { force: true, interactive: false, tools: catalogOf() };
  await wired.cleanUseCase.execute({ ...clean, projectRoot: ws.project });
  return recordedReport(ws, bases);
}

async function run(route: Route, toolId: AiToolId): Promise<string> {
  const ws = await workspace();
  if (route === "native-build" || route === "flat-translate") {
    const out = await build(ws, toolId, route === "native-build" ? "marketplace" : "flat");
    if (out === null) return "route not supported by this tool\n";
    return describeHookFiles(ws, [out]);
  }
  await installTool(ws.project, toolId);
  if (route === "setup-plugins-reinstall") {
    return `${await reinstallThroughSetup(ws)}\n\n${await describeHookFiles(ws, [ws.project, ws.home])}\n# recorded\n${await pluginsRecorded(ws)}`;
  }
  await installPlugin(ws.project, toolId, "aidd-context");
  await installPlugin(ws.project, toolId, "aidd-telemetry");
  return runOnInstalled(ws, route, toolId);
}

describe("the hook files every route writes and removes, per tool", () => {
  for (const toolId of catalogOf().idsInCanonicalOrder("ai")) {
    describe(toolId, () => {
      for (const route of ROUTES) {
        it(`${route} leaves exactly the pinned hook files`, async () => {
          const actual = await run(route, toolId);

          await expect(actual).toMatchFileSnapshot(join(FIXTURES, toolId, `${route}.txt`));
        });
      }
    });
  }
});
