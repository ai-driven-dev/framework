import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Set in the main process before any worker exists: a worker thread's own env never reaches `os.homedir()`, so only this leaves a mutant no real profile to write. */
export function setup(): () => void {
  const home = mkdtempSync(join(tmpdir(), "aidd-test-profile-"));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.APPDATA = join(home, "AppData", "Roaming");
  for (const key of ["AIDD_USER_CONFIG_DIR", "AIDD_TELEMETRY_DIR", "XDG_CONFIG_HOME"])
    delete process.env[key];
  return () => rmSync(home, { recursive: true, force: true });
}
