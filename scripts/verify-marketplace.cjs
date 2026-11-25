const { execFileSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { repository, tools } = require("./marketplace-distribution.json");

function verify(tool, version, source) {
  const target = Object.hasOwn(tools, tool) && tools[tool];
  if (!target || !version || !source) throw new Error("Usage: verify-marketplace.cjs <tool> <vVERSION> <catalog-directory>");

  const release = `${tool}-${version}`;
  const tagRef = `refs/tags/${release}`;
  const branchRef = `refs/heads/${target.ref}`;
  const refs = Object.fromEntries(
    execFileSync("git", ["ls-remote", "--exit-code", repository, tagRef, branchRef], { encoding: "utf8" })
      .trim().split("\n").map((line) => line.split("\t").reverse()),
  );
  if (!refs[tagRef] || !refs[branchRef]) throw new Error(`Expected ${tagRef} and ${branchRef} in ${repository}`);
  const ref = refs[tagRef] === refs[branchRef] ? target.ref : release;
  if (!target.clientPackage) {
    console.log(`${tool} ${version} Git ref is reachable. Verify installation in the actual client.`);
    return;
  }

  const catalog = JSON.parse(readFileSync(join(source, target.catalog), "utf8"));
  const plugin = "aidd-context";
  const manifest = JSON.parse(readFileSync(join(source, "plugins", plugin, target.manifest), "utf8"));
  if (!manifest.version) throw new Error(`${tool} did not generate a version for ${plugin}`);
  const name = target.name || catalog.name;
  const selector = `${plugin}@${name}`;
  const profile = mkdtempSync(join(tmpdir(), "aidd-marketplace-client-"));
  const env = { ...process.env, HOME: profile, USERPROFILE: profile };
  for (const key of ["CLAUDE_CONFIG_DIR", "CODEX_HOME", "COPILOT_HOME", "COPILOT_CACHE_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME"]) {
    env[key] = join(profile, key.toLowerCase());
    mkdirSync(env[key]);
  }
  const client = (...args) => execFileSync(tool, args, { cwd: profile, env, encoding: "utf8" });

  try {
    let installedVersion;
    if (tool === "codex") {
      client("plugin", "marketplace", "add", repository, "--ref", ref, "--json");
      const installed = JSON.parse(client("plugin", "add", selector, "--json"));
      installedVersion = installed.version;
    } else {
      client("plugin", "marketplace", "add", `${repository}#${ref}`);
      client("plugin", "install", selector);
      const installed = JSON.parse(client("plugin", "list", "--json"));
      installedVersion = installed.find((entry) => entry.id === selector || (entry.name === plugin && entry.marketplace === name))?.version;
    }
    if (installedVersion !== manifest.version) {
      throw new Error(`${tool} installed ${installedVersion ?? "no version"}, expected ${plugin} ${manifest.version} from ${ref}`);
    }
    console.log(`${tool} installed ${selector} ${installedVersion} from ${ref}`);
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
