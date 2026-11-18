/**
 * A module of a context has its test at the same path under `tests/`: `src/contexts/x/domain/y.ts`
 * is tested by `tests/contexts/x/domain/y.<level>.test.ts`, level being unit, integration or
 * contract. A test of the same name in another folder does not count.
 *
 * Two kinds of module owe no test of their own, and both are computed, never listed: a module left
 * with no runtime statement once its type declarations are stripped, and a data file of a tool's
 * profiles, which conformance and golden tests hold. Every other miss is in `MIRROR_BASELINE`.
 */
import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_ROOT, expectRatchet, read, sourceFiles } from "./helpers.js";
import { closingBracket, codeOnly } from "./source-shapes.js";

const CONTEXT_MODULE = /^src\/contexts\/.*(?<!\.d)\.ts$/;
const PROFILE_DATA_FOLDER = "src/contexts/tools/domain/profiles/";
const TEST_LEVELS = ["unit", "integration", "contract"] as const;
const TYPE_DECLARATION = /^(?:export\s+(?:declare\s+)?)?(interface|type)\s|^import\s+type\s/m;

// Modules whose mirror test is missing, each to be written or moved, never added to. An entry
// leaves when its test lands at the mirror path.
// Limit: writing the missing tests mechanically is barred; the list is the written exception.
const MIRROR_BASELINE: readonly string[] = [
  "src/contexts/distribution/application/check-marketplaces.ts",
  "src/contexts/distribution/application/ensure-framework-marketplace.ts",
  "src/contexts/distribution/application/plugin-source/resolve-plugin-source.ts",
  "src/contexts/distribution/application/plugin-source/trust-plugin-source.ts",
  "src/contexts/distribution/application/remove/remove-marketplace.ts",
  "src/contexts/distribution/application/resolve-built-marketplaces.ts",
  "src/contexts/distribution/contract/marketplace.ts",
  "src/contexts/distribution/contract/requested-version-policy.ts",
  "src/contexts/host-registration/application/inspect/inspect-declared-marketplaces.ts",
  "src/contexts/host-registration/application/inspect/inspect-host-registration.ts",
  "src/contexts/host-registration/domain/cache-purge-policy.ts",
  "src/contexts/host-registration/domain/registration-record.ts",
  "src/contexts/host-registration/infrastructure/marketplace-list-parsers.ts",
  "src/contexts/host-registration/infrastructure/plugin-registry-readers.ts",
  "src/contexts/installation/application/agents/agent-plugin-hosts.ts",
  "src/contexts/installation/application/agents/agent-providers.ts",
  "src/contexts/installation/application/agents/main-session-models.ts",
  "src/contexts/installation/application/doctor/check-plugin-drift.ts",
  "src/contexts/installation/application/doctor/list-registered-plugins.ts",
  "src/contexts/installation/application/doctor/load-manifest-for-doctor.ts",
  "src/contexts/installation/application/install/content/install-content-section.ts",
  "src/contexts/installation/application/list-installed-tools.ts",
  "src/contexts/installation/application/marketplace/list-plugin-sources.ts",
  "src/contexts/installation/application/marketplace/purge-marketplace-plugins.ts",
  "src/contexts/installation/application/marketplace/remove-plugins-from-marketplace.ts",
  "src/contexts/installation/application/materialize/built-tree-materialization-translator.ts",
  "src/contexts/installation/application/materialize/flat-mcp-materializer.ts",
  "src/contexts/installation/application/materialize/mode-a-marketplace-translator.ts",
  "src/contexts/installation/application/materialize/mode-b-flat-materialization-translator.ts",
  "src/contexts/installation/application/materialize/plugin-translator-factory.ts",
  "src/contexts/installation/application/plugin/plan-plugin-install.ts",
  "src/contexts/installation/application/plugin/update-user-plugin-files.ts",
  "src/contexts/installation/application/purge-user-scope-files.ts",
  "src/contexts/installation/application/removal/remove-plugin.ts",
  "src/contexts/installation/application/removal/remove-project-plugin.ts",
  "src/contexts/installation/application/restore/apply-plugin-files.ts",
  "src/contexts/installation/application/restore/project/restore-global.ts",
  "src/contexts/installation/application/restore/restore-drift-entries.ts",
  "src/contexts/installation/application/sync/activate-native-tools.ts",
  "src/contexts/installation/application/sync/build-marketplace-for-tool.ts",
  "src/contexts/installation/application/sync/load-sync-context.ts",
  "src/contexts/installation/application/sync/record-activation.ts",
  "src/contexts/installation/application/sync/sync-tool-settings-files.ts",
  "src/contexts/installation/contract/plugin-spec.ts",
  "src/contexts/installation/domain/manifest/merge-files.ts",
  "src/contexts/installation/infrastructure/agent-model-store-adapter.ts",
  "src/contexts/installation/infrastructure/manifest-file-io.ts",
  "src/contexts/installation/infrastructure/platform-adapter.ts",
  "src/contexts/machine-claims/application/detach-project-claims.ts",
  "src/contexts/machine-claims/application/record-source-reference.ts",
  "src/contexts/machine-claims/application/removal-claims.ts",
  "src/contexts/telemetry/application/branch-declarations.ts",
  "src/contexts/telemetry/application/consented-repositories.ts",
  "src/contexts/telemetry/application/declaration/resolve-task-request.ts",
  "src/contexts/telemetry/application/directory-resolver.ts",
  "src/contexts/telemetry/application/forget/remembered-clones.ts",
  "src/contexts/telemetry/application/identity/check-identity.ts",
  "src/contexts/telemetry/application/ledger-upkeep.ts",
  "src/contexts/telemetry/application/remembered-resolutions.ts",
  "src/contexts/telemetry/application/report/declared-bindings.ts",
  "src/contexts/telemetry/application/report/request-report.ts",
  "src/contexts/telemetry/application/report/resolve-report-request.ts",
  "src/contexts/telemetry/application/switch/clone-consent.ts",
  "src/contexts/telemetry/application/switch/disable-telemetry.ts",
  "src/contexts/telemetry/application/switch/enable-telemetry.ts",
  "src/contexts/telemetry/application/switch/read-transcript-retention.ts",
  "src/contexts/telemetry/application/switch/remember-own-root.ts",
  "src/contexts/telemetry/contract/claude-retention.ts",
  "src/contexts/telemetry/contract/report-filter.ts",
  "src/contexts/telemetry/contract/task-declaration.ts",
  "src/contexts/telemetry/contract/usage-record.ts",
  "src/contexts/telemetry/contract/usage-report.ts",
  "src/contexts/telemetry/infrastructure/legacy/repository-alias-store-adapter.ts",
  "src/contexts/telemetry/infrastructure/sources/line-values.ts",
  "src/contexts/telemetry/infrastructure/sources/transcript-files.ts",
  "src/contexts/telemetry/infrastructure/storage/consent/consent-history-adapter.ts",
  "src/contexts/telemetry/infrastructure/storage/ledger/left-out-adapter.ts",
  "src/contexts/telemetry/infrastructure/storage/ledger/resolution-store-adapter.ts",
  "src/contexts/tools/contract/config-refs.ts",
  "src/contexts/tools/contract/plugin-root-token.ts",
  "src/contexts/tools/contract/tool-profile.ts",
  "src/contexts/tools/contract/tool-recommendations.ts",
  "src/contexts/tools/domain/marketplace-entry.ts",
  "src/contexts/tools/domain/profile.ts",
  "src/contexts/tools/domain/sections/models-section.ts",
  "src/contexts/translate/application/build-native-tree.ts",
  "src/contexts/translate/application/shared-plugin-helpers.ts",
  "src/contexts/translate/application/sink/disk-sink.ts",
  "src/contexts/translate/contract/build-targets.ts",
  "src/contexts/translate/domain/canon-format.ts",
  "src/contexts/translate/domain/engine.ts",
  "src/contexts/translate/domain/flat-layout.ts",
];

/** The end of a type declaration: the brace closing an interface, else the next top-level `;`. */
function declarationEnd(code: string, from: number, keyword: string | undefined): number {
  if (keyword === "interface") return closingBracket(code, code.indexOf("{", from)) + 1;
  let depth = 0;
  for (let at = from; at < code.length; at++) {
    if (code[at] === "=" && code[at + 1] === ">") at++;
    else if ("([{<".includes(code[at] as string)) depth++;
    else if (")]}>".includes(code[at] as string)) depth--;
    else if (code[at] === ";" && depth === 0) return at + 1;
  }
  return code.length;
}

function withoutTypeDeclarations(code: string): string {
  const declaration = TYPE_DECLARATION.exec(code);
  if (declaration === null) return code;
  const end = declarationEnd(code, declaration.index, declaration[1]);
  return withoutTypeDeclarations(code.slice(0, declaration.index) + code.slice(end));
}

function isTypeOnly(source: string): boolean {
  return withoutTypeDeclarations(codeOnly(source)).trim() === "";
}

function isProfileData(module: string): boolean {
  return module.startsWith(PROFILE_DATA_FOLDER);
}

function mirrorTestsOf(module: string): string[] {
  const mirrored = module.replace(/^src\//, "tests/").replace(/\.ts$/, "");
  return TEST_LEVELS.map((level) => `${mirrored}.${level}.test.ts`);
}

function testFiles(): string[] {
  return readdirSync(join(CLI_ROOT, "tests"), { recursive: true, encoding: "utf8" })
    .map((entry) => join("tests", entry).split(sep).join("/"))
    .filter((path) => path.endsWith(".test.ts"));
}

function ownedModules(): string[] {
  return sourceFiles().filter((file) => CONTEXT_MODULE.test(file));
}

/** The modules owing a mirror test that has none, sorted. */
function missingMirrors(
  modules: readonly string[],
  tests: readonly string[],
  sourceOf: (module: string) => string
): string[] {
  const present = new Set(tests);
  return modules
    .filter((module) => !isProfileData(module) && !isTypeOnly(sourceOf(module)))
    .filter((module) => !mirrorTestsOf(module).some((test) => present.has(test)))
    .sort();
}

describe("a module has its test at the mirror path", () => {
  it("every module owing one has it, or is a known miss", () => {
    const owned = ownedModules();
    expect(owned.length, "the rule selects no module: its scope is stale").toBeGreaterThan(0);
    const { added, fixed } = expectRatchet(
      missingMirrors(owned, testFiles(), read),
      MIRROR_BASELINE
    );
    expect(added, "a module has no test at its mirror path").toEqual([]);
    expect(fixed, "a module is tested now: remove it from MIRROR_BASELINE").toEqual([]);
  });

  describe("plant", () => {
    const module = "src/contexts/x/domain/y.ts";
    const runtime = "export const y = 1;";
    const missing = (tests: string[], source = runtime, path = module): string[] =>
      missingMirrors([path], tests, () => source);

    it("flags a module with no mirror test", () => {
      expect(missing([])).toEqual([module]);
    });

    it("flags a module whose test of the same name sits in another folder", () => {
      expect(missing(["tests/contexts/x/application/y.unit.test.ts"])).toEqual([module]);
    });

    it.each(TEST_LEVELS)("clears a %s test at the mirror path", (level) => {
      expect(missing([`tests/contexts/x/domain/y.${level}.test.ts`])).toEqual([]);
    });

    it("excludes a type-only module", () => {
      const source =
        "import type { A } from './a.js';\nexport interface Y { a: A }\nexport type Z = { b: () => void };";
      expect(missing([], source)).toEqual([]);
    });

    it("flags a module that keeps one runtime statement beside its types", () => {
      expect(missing([], "export interface Y { a: 1 }\nexport const y = 1;")).toEqual([module]);
    });

    it("excludes the data file of a tool's profile", () => {
      const profileFile = `${PROFILE_DATA_FOLDER}claude/claude-paths.ts`;
      expect(missing([], runtime, profileFile)).toEqual([]);
    });

    it("keeps a tools module outside the profiles folder", () => {
      const toolsFile = "src/contexts/tools/domain/catalog.ts";
      expect(missing([], runtime, toolsFile)).toEqual([toolsFile]);
    });
  });
});
