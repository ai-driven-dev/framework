/**
 * A module of a context has its test at the same path under `tests/`: `src/contexts/x/domain/y.ts`
 * is tested by `tests/contexts/x/domain/y.<level>.test.ts`, level being unit, integration or
 * contract, or `y.<facet>.<level>.test.ts` where a module's test is split by facet. A test of the
 * same name in another folder does not count.
 *
 * Two kinds of module owe no test of their own, and both are computed, never listed: a module left
 * with no runtime statement once its type declarations are stripped, and a module of a tool's
 * profiles that declares no function, arrow or class, which conformance and golden tests hold. Every other miss is in `MIRROR_BASELINE`.
 * Ambient declaration files are no module: they hold no runtime to test.
 *
 * Limit: `declarationEnd` counts brackets inside string literals; a type alias whose string holds
 * an unbalanced bracket hides the code after it. No module does that today.
 */
import { posix } from "node:path";
import { describe, expect, it } from "vitest";
import { expectRatchet, read, sourceFiles, testFiles } from "./helpers.js";
import { closingBracket, codeOnly, scanBrackets } from "./source-shapes.js";

const CONTEXT_MODULE = /^src\/contexts\/.*(?<!\.d)\.ts$/;
const PROFILE_FOLDER = "src/contexts/tools/domain/profiles/";
const BEHAVIOUR = /\bfunction\b|=>|\bclass\b/;
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
  "src/contexts/host-registration/infrastructure/marketplace-list-parsers.ts",
  "src/contexts/installation/application/agents/agent-plugin-hosts.ts",
  "src/contexts/installation/application/agents/agent-providers.ts",
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
  "src/contexts/installation/application/removal/remove-project-plugin.ts",
  "src/contexts/installation/application/restore/apply-plugin-files.ts",
  "src/contexts/installation/application/restore/project/restore-global.ts",
  "src/contexts/installation/application/restore/restore-drift-entries.ts",
  "src/contexts/installation/application/sync/activate-native-tools.ts",
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
  "src/contexts/tools/contract/tool-profile.ts",
  "src/contexts/tools/contract/tool-recommendations.ts",
  "src/contexts/tools/domain/marketplace-entry.ts",
  "src/contexts/tools/domain/profile.ts",
  "src/contexts/tools/domain/profiles/claude/claude-agent.ts",
  "src/contexts/tools/domain/profiles/codex/codex-paths.ts",
  "src/contexts/tools/domain/profiles/copilot/copilot-agent.ts",
  "src/contexts/tools/domain/profiles/cursor/cursor-agent.ts",
  "src/contexts/tools/domain/profiles/kilo/kilo-agent.ts",
  "src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.ts",
  "src/contexts/tools/domain/profiles/kilo/kilo-paths.ts",
  "src/contexts/tools/domain/profiles/opencode/opencode-agent.ts",
  "src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.ts",
  "src/contexts/tools/domain/sections/models-section.ts",
  "src/contexts/translate/application/shared-plugin-helpers.ts",
  "src/contexts/translate/contract/build-targets.ts",
  "src/contexts/translate/domain/canon-format.ts",
  "src/contexts/translate/domain/engine.ts",
  "src/contexts/translate/domain/flat-layout.ts",
];

/** The end of a type declaration: the brace closing an interface, else the next top-level `;`. */
function declarationEnd(code: string, from: number, keyword: string | undefined): number {
  if (keyword === "interface") return closingBracket(code, code.indexOf("{", from)) + 1;
  const semicolon = scanBrackets(code, from, (char, depth) => char === ";" && depth === 0);
  return Math.min(semicolon + 1, code.length);
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

function declaresBehaviour(source: string): boolean {
  return BEHAVIOUR.test(withoutTypeDeclarations(codeOnly(source)));
}

/** A module of the profiles folder that declares no function, arrow or class: tables, not logic. */
function isProfileData(module: string, source: string): boolean {
  return module.startsWith(PROFILE_FOLDER) && !declaresBehaviour(source);
}

/** `<base>.<level>.test.ts`, or `<base>.<facet>.<level>.test.ts`, in the module's mirror folder. */
function isMirrorTest(module: string, test: string): boolean {
  const mirrorFolder = posix.dirname(module.replace(/^src\//, "tests/"));
  if (posix.dirname(test) !== mirrorFolder) return false;
  const base = posix.basename(module, ".ts");
  return new RegExp(`^${base}\\.(?:[\\w-]+\\.)*(?:${TEST_LEVELS.join("|")})\\.test\\.ts$`).test(
    posix.basename(test)
  );
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
  return modules
    .filter((module) => !isTypeOnly(sourceOf(module)) && !isProfileData(module, sourceOf(module)))
    .filter((module) => !tests.some((test) => isMirrorTest(module, test)))
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

    it("clears a facet test at the mirror path", () => {
      expect(missing(["tests/contexts/x/domain/y.edges.integration.test.ts"])).toEqual([]);
    });

    it("clears a test with a facet of several segments at the mirror path", () => {
      expect(missing(["tests/contexts/x/domain/y.flat.agent-path.integration.test.ts"])).toEqual(
        []
      );
    });

    it("flags a facet test that sits in another folder", () => {
      expect(missing(["tests/contexts/x/application/y.edges.unit.test.ts"])).toEqual([module]);
    });

    it("flags a test of another module whose name only starts like it", () => {
      expect(missing(["tests/contexts/x/domain/yy.unit.test.ts"])).toEqual([module]);
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
      const profileFile = `${PROFILE_FOLDER}claude/claude-paths.ts`;
      expect(missing([], runtime, profileFile)).toEqual([]);
    });

    it.each([
      ["a function", "export function pathsOf() { return 1; }"],
      ["an arrow", "export const pathsOf = () => 1;"],
      ["a class", "export class Paths {}"],
    ])("flags a profile module that declares %s", (_, source) => {
      const profileFile = `${PROFILE_FOLDER}codex/codex-paths.ts`;
      expect(missing([], source, profileFile)).toEqual([profileFile]);
    });

    it("excludes a profile module whose only arrow is in a type", () => {
      const profileFile = `${PROFILE_FOLDER}codex/codex-paths.ts`;
      expect(missing([], `${runtime}\nexport type Pick = () => void;`, profileFile)).toEqual([]);
    });

    it("keeps a tools module outside the profiles folder", () => {
      const toolsFile = "src/contexts/tools/domain/catalog.ts";
      expect(missing([], runtime, toolsFile)).toEqual([toolsFile]);
    });
  });
});
