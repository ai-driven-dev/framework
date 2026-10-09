const path = require("node:path");
const os = require("node:os");

function set(value) {
  return typeof value === "string" && value !== "" ? value : null;
}

/** Where the person's telemetry lives. Same rule as the CLI, pinned by the shared fixture:
 * an empty variable is unset, and `platform` picks the separator so a Windows answer can be
 * checked anywhere. */
function telemetryDir({ env = process.env, platform = process.platform, home } = {}) {
  const flavour = platform === "win32" ? path.win32 : path.posix;
  const explicit = set(env.AIDD_TELEMETRY_DIR);
  if (explicit) return explicit;
  const userConfig = set(env.AIDD_USER_CONFIG_DIR);
  if (userConfig) return flavour.join(userConfig, "telemetry");
  const xdg = set(env.XDG_CONFIG_HOME);
  if (xdg) return flavour.join(xdg, "aidd", "telemetry");
  const base = home ?? set(env.HOME) ?? os.homedir();
  return flavour.join(base, ".config", "aidd", "telemetry");
}

module.exports = { telemetryDir };
