/**
 * A use case never catches its own errors: only a scenario collects a partial failure, and it
 * keeps the typed error. The `application/` files of a context that still catch are listed with
 * how many, and may not grow; one that stops catching must come off the list, so it only ever
 * gets shorter.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./source-graph.js";

/** Files in a context's `application/` folder that hold a `catch` block or a `.catch(` call, and how many. */
const CATCHES: Readonly<Record<string, number>> = {
  "src/contexts/distribution/application/check-marketplaces.use-case.ts": 1,
  "src/contexts/distribution/application/fetch-marketplace-source.use-case.ts": 2,
  "src/contexts/distribution/application/list-marketplaces.use-case.ts": 1,
  "src/contexts/distribution/application/refresh-marketplace.use-case.ts": 2,
  "src/contexts/distribution/application/resolve-built-marketplaces.use-case.ts": 1,
  "src/contexts/host-registration/application/confirmation.ts": 1,
  "src/contexts/host-registration/application/host-marketplace-source-conflict.ts": 1,
  "src/contexts/host-registration/application/inspect/inspect-declared-marketplaces.use-case.ts": 1,
  "src/contexts/host-registration/application/native-marketplace-source-proof.ts": 2,
  "src/contexts/host-registration/application/read-marketplace-catalog-identity.ts": 2,
  "src/contexts/host-registration/application/register/catalog-source-guard.ts": 1,
  "src/contexts/host-registration/application/register/native-catalog-proof.ts": 1,
  "src/contexts/host-registration/application/register/reclaim-dead-registration.ts": 3,
  "src/contexts/host-registration/application/register/register-marketplace.ts": 2,
  "src/contexts/host-registration/application/withdraw/assert-project-source.ts": 1,
  "src/contexts/host-registration/application/withdraw/host-call.ts": 1,
  "src/contexts/host-registration/application/withdraw/uninstall-project-ref.ts": 1,
  "src/contexts/installation/application/agents/main-session-models.use-case.ts": 2,
  "src/contexts/installation/application/doctor/load-manifest.use-case.ts": 1,
  "src/contexts/installation/application/install/config/build-config-files.ts": 1,
  "src/contexts/installation/application/install/install-ai-tool.use-case.ts": 1,
  "src/contexts/installation/application/marketplace/cache-built-marketplace.use-case.ts": 1,
  "src/contexts/installation/application/materialize/flat-mcp-materializer.ts": 1,
  "src/contexts/installation/application/materialize/project-hooks-materializer.use-case.ts": 1,
  "src/contexts/installation/application/ownership/project-path-boundary.ts": 1,
  "src/contexts/installation/application/plugin/global-plugin-files.ts": 1,
  "src/contexts/installation/application/plugin/update-user-plugin-files.use-case.ts": 1,
  "src/contexts/installation/application/removal/purge-machine-state.ts": 2,
  "src/contexts/installation/application/removal/remove-flat-mcp-entries.ts": 1,
  "src/contexts/installation/application/removal/remove-project-plugin.ts": 1,
  "src/contexts/installation/application/shared/assert-project-hooks-unchanged.ts": 2,
  "src/contexts/installation/application/sync/build-marketplace-for-tool.use-case.ts": 1,
  "src/contexts/installation/application/sync/load-sync-context.use-case.ts": 1,
  "src/contexts/installation/application/sync/record-activation.use-case.ts": 1,
  "src/contexts/installation/application/update/update-tool.use-case.ts": 1,
  "src/contexts/machine-claims/application/purge-declared-cache.ts": 1,
  "src/contexts/machine-claims/application/shared-source-reference-support.ts": 1,
  "src/contexts/recipes/application/validate-recipes.use-case.ts": 1,
  "src/contexts/translate/application/build-native-tree.use-case.ts": 2,
  "src/contexts/translate/application/sinks/flat-hooks-writer.ts": 1,
};

const CATCH = /\bcatch\s*[({]/g;

function catchCount(source: string): number {
  return source.match(CATCH)?.length ?? 0;
}

function inContextApplication(file: string): boolean {
  return /^src\/contexts\/[^/]+\/application\//.test(file);
}

describe("application catches", () => {
  it("counts a catch block and a catch call, and nothing else", () => {
    const source =
      "try { a(); } catch (e) { b(); }\nawait c().catch(() => 0);\nconst w = 'catches';";

    expect(catchCount(source)).toBe(2);
  });

  it("holds every context application file to the catches written down for it", () => {
    const found = Object.fromEntries(
      sourceFiles()
        .filter(inContextApplication)
        .map((file) => [file, catchCount(read(file))] as const)
        .filter(([, count]) => count > 0)
    );

    expect(found).toEqual(CATCHES);
  });
});
