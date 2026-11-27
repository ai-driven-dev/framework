/* Drives a real host binary through its plugin and marketplace subcommands inside a throwaway
 * HOME and returns what it did, scrubbed of this machine. Used by `pnpm record:host <host>`, which
 * writes the answer under tests/fixtures/hosts, and by the contract suites that compare a live
 * host with that recording.
 *
 * No command here calls a model or needs a login: only subcommands over local marketplaces the
 * recording writes itself. The host sees a minimal environment, never the caller's. POSIX only. */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const COMMAND_TIMEOUT_MS = 120000;
const MARKETPLACE_NAME = { claude: "mk-one", codex: "cx-one", copilot: "mk-one" };
const TERMINAL_CODES = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "g");
const PLUGIN_REF = (host) => `p@${MARKETPLACE_NAME[host]}`;

/** What each host exposes: the registry files and cache tree read after every step. */
const HOSTS = {
  claude: {
    binary: "claude",
    registryFiles: [".claude/plugins/known_marketplaces.json"],
    treeRoot: undefined,
  },
  codex: {
    binary: "codex",
    registryFiles: [".codex/config.toml"],
    treeRoot: ".codex/plugins/cache",
  },
  copilot: {
    binary: "copilot",
    registryFiles: [".copilot/settings.json"],
    treeRoot: undefined,
  },
};

export const RECORDED_HOSTS = Object.keys(HOSTS);

/** The host's own `--version`, as `x.y.z`, asked inside a throwaway HOME; absent when the binary
 * is not on PATH. */
export function hostVersion(host) {
  const sandbox = createSandbox();
  try {
    const run = spawnSync(HOSTS[host].binary, ["--version"], {
      cwd: sandbox.proj,
      env: sandbox.env,
      encoding: "utf-8",
      timeout: 30000,
    });
    if (run.error !== undefined || run.status !== 0) return undefined;
    return /\d+\.\d+\.\d+/.exec(run.stdout)?.[0];
  } finally {
    sandbox.dispose();
  }
}

/** A throwaway HOME, project and marketplace root. The environment names nothing of the caller's
 * but PATH, so no credential of theirs reaches a host. */
export function createSandbox() {
  const work = realpathSync(mkdtempSync(join(tmpdir(), "aidd-host-recording-")));
  const home = join(work, "home");
  const proj = join(work, "proj");
  const markets = join(work, "markets");
  for (const dir of [home, join(home, ".codex"), proj, markets])
    mkdirSync(dir, { recursive: true });
  const env = {
    PATH: process.env.PATH ?? "",
    HOME: home,
    CODEX_HOME: join(home, ".codex"),
    COPILOT_HOME: join(home, ".copilot"),
    XDG_CONFIG_HOME: join(home, ".config"),
  };
  return { work, home, proj, markets, env, dispose: () => rmSync(work, { recursive: true }) };
}

const PLUGIN_MANIFEST = { name: "p", version: "1.0.0", description: "d" };

/** A local marketplace named for the host, holding one plugin `p`, in the format the host reads. */
export function writeMarketplace(host, dir, plugin = "p") {
  const name = MARKETPLACE_NAME[host];
  const manifestDir = host === "codex" ? ".codex-plugin" : ".claude-plugin";
  const pluginDir = join(dir, "plugins", plugin);
  mkdirSync(join(pluginDir, manifestDir), { recursive: true });
  mkdirSync(join(pluginDir, "skills", "s"), { recursive: true });
  writeFileSync(
    join(pluginDir, manifestDir, "plugin.json"),
    JSON.stringify(host === "codex" ? { ...PLUGIN_MANIFEST, skills: "./skills" } : PLUGIN_MANIFEST)
  );
  writeFileSync(
    join(pluginDir, "skills", "s", "SKILL.md"),
    "---\nname: s\ndescription: d\n---\nx\n"
  );
  const catalogDir = join(dir, host === "codex" ? ".agents/plugins" : ".claude-plugin");
  mkdirSync(catalogDir, { recursive: true });
  const entry =
    host === "codex"
      ? {
          name: plugin,
          source: { source: "local", path: `./plugins/${plugin}` },
          policy: { installation: "AVAILABLE", authentication: "ON_USE" },
          category: "Developer Tools",
        }
      : { name: plugin, source: `./plugins/${plugin}`, description: "d" };
  const catalog =
    host === "codex"
      ? { name, interface: { displayName: name }, plugins: [entry] }
      : { name, owner: { name: "o" }, plugins: [entry] };
  writeFileSync(join(catalogDir, "marketplace.json"), JSON.stringify(catalog));
}

function scrubberFor(sandbox) {
  const replacements = [
    [sandbox.home, "<home>"],
    [sandbox.proj, "<proj>"],
    [sandbox.markets, "<markets>"],
    [sandbox.work, "<work>"],
  ];
  return (text) => {
    let scrubbed = text
      .replace(TERMINAL_CODES, "")
      .replace(/\b\d+ms\b/g, "<duration>")
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, "<timestamp>");
    for (const [path, placeholder] of replacements)
      scrubbed = scrubbed.replaceAll(path, placeholder);
    return scrubbed;
  };
}

function listTree(root) {
  if (!existsSync(root)) return [];
  const paths = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      paths.push(relative(root, full));
      if (entry.isDirectory()) walk(full);
    }
  };
  walk(root);
  return paths.sort();
}

/** Runs the host's scenarios in a fresh sandbox. Each step keeps its arguments, exit status,
 * output, the registry files after it, and the cache tree for a host that has one. */
export function recordHost(host) {
  const spec = HOSTS[host];
  const version = hostVersion(host);
  if (version === undefined) throw new Error(`${spec.binary} is not on PATH`);
  const sandbox = createSandbox();
  try {
    const scrub = scrubberFor(sandbox);
    const steps = [];
    const marketA = join(sandbox.markets, "a");
    const marketB = join(sandbox.markets, "b");
    writeMarketplace(host, marketA);
    writeMarketplace(host, marketB);

    const step = (id, args) => {
      const run = spawnSync(spec.binary, args, {
        cwd: sandbox.proj,
        env: sandbox.env,
        encoding: "utf-8",
        timeout: COMMAND_TIMEOUT_MS,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const files = {};
      for (const file of spec.registryFiles) {
        const path = join(sandbox.home, file);
        if (existsSync(path)) files[file] = scrub(readFileSync(path, "utf-8"));
      }
      steps.push({
        id,
        args: args.map(scrub),
        status: run.status,
        stdout: scrub(run.stdout ?? ""),
        stderr: scrub(run.stderr ?? ""),
        files,
        ...(spec.treeRoot === undefined
          ? {}
          : { tree: listTree(join(sandbox.home, spec.treeRoot)) }),
      });
    };

    const ref = PLUGIN_REF(host);
    const name = MARKETPLACE_NAME[host];
    if (host === "claude") {
      step("add-first-source", ["plugin", "marketplace", "add", marketA]);
      step("add-second-source", ["plugin", "marketplace", "add", marketB]);
      step("marketplace-list", ["plugin", "marketplace", "list", "--json"]);
      step("install-local-scope", ["plugin", "install", ref, "--scope", "local", "--yes"]);
      step("uninstall-user-scope", ["plugin", "uninstall", ref, "--scope", "user", "--yes"]);
      step("plugin-list-after-refusal", ["plugin", "list", "--json"]);
      step("uninstall-local-scope", ["plugin", "uninstall", ref, "--scope", "local", "--yes"]);
      step("remove-marketplace", ["plugin", "marketplace", "remove", name]);
    } else if (host === "codex") {
      step("add-first-source", ["plugin", "marketplace", "add", marketA]);
      step("add-second-source", ["plugin", "marketplace", "add", marketB]);
      step("marketplace-list", ["plugin", "marketplace", "list", "--json"]);
      step("upgrade-local-marketplace", ["plugin", "marketplace", "upgrade", name]);
      step("install", ["plugin", "add", ref]);
      step("plugin-list", ["plugin", "list", "--json"]);
      step("remove", ["plugin", "remove", ref]);
      step("remove-marketplace", ["plugin", "marketplace", "remove", name]);
    } else {
      step("add-first-source", ["plugin", "marketplace", "add", marketA]);
      step("add-second-source", ["plugin", "marketplace", "add", marketB]);
      step("marketplace-list", ["plugin", "marketplace", "list", "--json"]);
      step("install", ["plugin", "install", ref]);
      step("update-plugin", ["plugin", "update", ref]);
      step("update-marketplace-present", ["plugin", "marketplace", "update", name]);
      renameSync(marketA, `${marketA}-gone`);
      step("update-marketplace-vanished", ["plugin", "marketplace", "update", name]);
      renameSync(`${marketA}-gone`, marketA);
      step("plugin-list", ["plugin", "list", "--json"]);
      step("uninstall", ["plugin", "uninstall", ref]);
      step("plugin-list-after-uninstall", ["plugin", "list", "--json"]);
      step("remove-marketplace", ["plugin", "marketplace", "remove", name]);
    }
    return { host, version, steps };
  } finally {
    sandbox.dispose();
  }
}
