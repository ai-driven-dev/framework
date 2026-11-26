const { execFileSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { catalogName, repository: published } = require("./marketplace-distribution.json");
const { installedPlugins } = require("./lib/host-plugins.cjs");
const { toolOf } = require("./marketplace-tools.cjs");

/** What differs per client: how it adds a Git catalog at a ref, and the verb that installs. */
const GIT_REF = {
  add: (repository, ref) => ["plugin", "marketplace", "add", `${repository}#${ref}`],
  install: "install",
};
const CLIENTS = {
  codex: { add: (repository, ref) => ["plugin", "marketplace", "add", repository, "--ref", ref], install: "add" },
};

function verify(toolId, version, source, repository = published) {
  const tool = toolOf(toolId);
  if (!tool || !version || !source) throw new Error("Usage: verify-marketplace.cjs <tool> <vVERSION> <catalog-directory> [git-repository]");

  const release = `${toolId}-${version}`;
  const tagRef = `refs/tags/${release}`;
  const branchRef = `refs/heads/${toolId}`;
  const refs = Object.fromEntries(
    execFileSync("git", ["ls-remote", "--exit-code", repository, tagRef, branchRef], { encoding: "utf8" })
      .trim().split("\n").map((line) => line.split("\t").reverse()),
  );
  if (!refs[tagRef] || !refs[branchRef]) throw new Error(`Expected ${tagRef} and ${branchRef} in ${repository}`);
  const ref = refs[tagRef] === refs[branchRef] ? toolId : release;
  if (!tool.client) {
    console.log(`${toolId} ${version} Git ref is reachable. Verify installation in the actual client.`);
    return;
  }

  const plugin = "aidd-context";
  const manifest = JSON.parse(readFileSync(join(source, "plugins", plugin, tool.manifest), "utf8"));
  if (!manifest.version) throw new Error(`${toolId} did not generate a version for ${plugin}`);
  const profile = mkdtempSync(join(tmpdir(), "aidd-marketplace-client-"));
  const env = { ...process.env, HOME: profile, USERPROFILE: profile };
  for (const key of ["CLAUDE_CONFIG_DIR", "CODEX_HOME", "COPILOT_HOME", "COPILOT_CACHE_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME"]) {
    env[key] = join(profile, key.toLowerCase());
    mkdirSync(env[key]);
  }
  const client = (...args) => execFileSync(tool.client, args, { cwd: profile, env, encoding: "utf8" });
  const { add, install } = CLIENTS[tool.client] ?? GIT_REF;

  try {
    client(...add(repository, ref));
    client("plugin", install, `${plugin}@${catalogName}`);
    const installed = installedPlugins(tool.client, client("plugin", "list", "--json"))
      .find((entry) => entry.name === plugin && entry.marketplace === catalogName);
    if (installed?.version !== manifest.version) {
      throw new Error(`${toolId} installed ${installed?.version ?? "no version"}, expected ${plugin} ${manifest.version} from ${ref}`);
    }
    console.log(`${toolId} installed ${plugin}@${catalogName} ${installed.version} from ${ref}`);
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    verify(...process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
