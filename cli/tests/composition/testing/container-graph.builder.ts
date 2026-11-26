import { join } from "node:path";
import { vi } from "vitest";
import { containerFactory } from "../../../src/composition/container.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import type { Output } from "../../../src/presentation/terminal/output.model.js";
import type { Scope } from "../../../src/shared/domain/scope.js";
import type { catalogOf } from "../../shared/testing/catalog-of.builder.js";

export const containerOf = (
  projectRoot: string,
  options: Parameters<ReturnType<typeof containerFactory>>[1],
  output: Output | undefined,
  tools: ReturnType<typeof catalogOf>
) => containerFactory(tools)(projectRoot, options, output);

export const SAMPLE_MARKETPLACE = join(
  process.cwd(),
  "tests/fixtures/framework/marketplace-sample"
);

// A machine of its own: no home, no user config, no token and no host binary of the real
// one. `HOME` alone only sandboxes POSIX: `os.homedir()` reads `USERPROFILE` on Windows,
// and the config-dir rule reads `APPDATA` ahead of it.
export function stubMachineEnv(root: string): void {
  const home = join(root, "home");
  vi.stubEnv("HOME", home);
  vi.stubEnv("USERPROFILE", home);
  vi.stubEnv("APPDATA", join(home, "AppData", "Roaming"));
  vi.stubEnv("AIDD_USER_CONFIG_DIR", join(root, "user-config"));
  vi.stubEnv("PATH", join(root, "no-binaries"));
  vi.stubEnv("AIDD_TOKEN", undefined);
  vi.stubEnv("GH_TOKEN", undefined);
  vi.stubEnv("GITHUB_TOKEN", undefined);
}

export const aPlugin = (scope: Scope, extra: { mcpEntries?: Record<string, string> } = {}) =>
  RecordedPlugin.fromJSON({
    name: "aidd-dev",
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    version: "1.0.0",
    strict: true,
    files: {},
    scope,
    ...extra,
  });
