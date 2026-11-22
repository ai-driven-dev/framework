/** At a host that enables a plugin machine-wide (no `NativeActivation.scopeArgs` - codex,
 * copilot), a ref is left enabled while another project still references its shared source. */

import { describe, expect, it } from "vitest";
import { UserSourceReferencesAdapter } from "../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";
import {
  buildUseCase,
  OTHER_PROJECT,
  OTHER_PROJECT_BYTES,
  PROJECT_ROOT,
  provenRegistration,
  seedManifest,
  seedReferences,
  seedSharedMarketplaceRegistry,
  USER_CONFIG_DIR,
} from "../testing/clean-shared-ref-guard.builder.js";

describe("clean guards a ref another project on this machine still needs", () => {
  it("keeps codex's ref enabled and names the other project still referencing the shared source", async () => {
    const fs = new InMemoryFileAdapter({});
    seedReferences(fs, [OTHER_PROJECT]);
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();

    const useCase = buildUseCase({
      tools: registeredTools(),
      fs,
      manifest: seedManifest(
        TOOL.codex,
        [provenRegistration(TOOL.codex, "aidd-framework", "aidd-framework")],
        ["aidd-vcs@aidd-framework"]
      ),
      activator,
      binary: TOOL.codex,
      logger,
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(activator.uninstalledPlugins).not.toContain("aidd-vcs@aidd-framework");
    expect(fs.getFile(`${USER_CONFIG_DIR}/references.json`)).toContain(OTHER_PROJECT);
    expect(fs.getFile(`${OTHER_PROJECT}/marker`)).toBe(OTHER_PROJECT_BYTES);
    expect(
      logger.warnMessages.some((m) => m.includes("left enabled") && m.includes(OTHER_PROJECT))
    ).toBe(true);
  });

  it("leaves an unclaimed machine-global Codex ref enabled after the last local reference", async () => {
    const fs = new InMemoryFileAdapter({});
    seedReferences(fs, []);
    const activator = new FakeHostActions({ available: true });

    const useCase = buildUseCase({
      tools: registeredTools(),
      fs,
      manifest: seedManifest(
        TOOL.codex,
        [provenRegistration(TOOL.codex, "aidd-framework", "aidd-framework")],
        ["aidd-vcs@aidd-framework"]
      ),
      activator,
      binary: TOOL.codex,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(
      await new UserSourceReferencesAdapter(fs, () => USER_CONFIG_DIR).listAllReferencingProjects()
    ).not.toContain(PROJECT_ROOT);
  });

  it("still disables claude's ref even with another project referencing the shared source", async () => {
    const fs = new InMemoryFileAdapter({});
    seedReferences(fs, [OTHER_PROJECT]);
    const activator = new FakeHostActions({ available: true });

    const useCase = buildUseCase({
      tools: registeredTools(),
      fs,
      manifest: seedManifest(
        TOOL.claude,
        [provenRegistration(TOOL.claude, "aidd-framework", "aidd-framework")],
        ["aidd-vcs@aidd-framework"]
      ),
      activator,
      binary: TOOL.claude,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(activator.uninstalledPlugins).toContain("aidd-vcs@aidd-framework");
    expect(fs.getFile(`${OTHER_PROJECT}/marker`)).toBe(OTHER_PROJECT_BYTES);
  });

  it("leaves both unclaimed Codex refs enabled despite a distinct project catalogue", async () => {
    const fs = new InMemoryFileAdapter({});
    seedReferences(fs, [OTHER_PROJECT]);
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();

    const useCase = buildUseCase({
      tools: registeredTools(),
      fs,
      manifest: seedManifest(
        TOOL.codex,
        [
          provenRegistration(TOOL.codex, "aidd-framework", "aidd-framework"),
          provenRegistration(TOOL.codex, "other-mkt", "other-mkt"),
        ],
        ["aidd-vcs@aidd-framework", "plugin-b@other-mkt"]
      ),
      activator,
      binary: TOOL.codex,
      logger,
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(true),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.getFile(`${USER_CONFIG_DIR}/references.json`)).toContain(OTHER_PROJECT);
    expect(fs.getFile(`${OTHER_PROJECT}/marker`)).toBe(OTHER_PROJECT_BYTES);
    const warning = (ref: string) => logger.warnMessages.find((m) => m.includes(`'${ref}'`));
    expect(warning("aidd-vcs@aidd-framework")).toContain(OTHER_PROJECT);
    expect(warning("plugin-b@other-mkt")).not.toContain(OTHER_PROJECT);
  });

  it("leaves both unclaimed Codex refs enabled when the project catalogue is listed first", async () => {
    const fs = new InMemoryFileAdapter({});
    seedReferences(fs, [OTHER_PROJECT]);
    const activator = new FakeHostActions({ available: true });

    const useCase = buildUseCase({
      tools: registeredTools(),
      fs,
      manifest: seedManifest(
        TOOL.codex,
        [
          provenRegistration(TOOL.codex, "other-mkt", "other-mkt"),
          provenRegistration(TOOL.codex, "aidd-framework", "aidd-framework"),
        ],
        ["plugin-b@other-mkt", "aidd-vcs@aidd-framework"]
      ),
      activator,
      binary: TOOL.codex,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(true),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(fs.getFile(`${USER_CONFIG_DIR}/references.json`)).toContain(OTHER_PROJECT);
    expect(fs.getFile(`${OTHER_PROJECT}/marker`)).toBe(OTHER_PROJECT_BYTES);
  });

  it("leaves an unclaimed global Codex ref enabled even without a recorded project reference", async () => {
    const fs = new InMemoryFileAdapter({});
    // No references.json at all: no claim of this project's own to drop, and nothing else
    // referencing the source to guard on either.
    const activator = new FakeHostActions({ available: true });

    const useCase = buildUseCase({
      tools: registeredTools(),
      fs,
      manifest: seedManifest(
        TOOL.codex,
        [provenRegistration(TOOL.codex, "aidd-framework", "aidd-framework")],
        ["aidd-vcs@aidd-framework"]
      ),
      activator,
      binary: TOOL.codex,
      logger: new CapturingLogger(),
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(activator.uninstalledPlugins).toEqual([]);
    expect(activator.removedMarketplaces).toEqual([]);
  });

  // "This project's own claim was never recorded" and "no other project references it" are
  // different facts: only `OTHER_PROJECT` is named here, and its live claim still guards.
  it("keeps codex's ref enabled when this project's own claim was never recorded but another project's still is", async () => {
    const fs = new InMemoryFileAdapter({});
    fs.setFile(`${USER_CONFIG_DIR}/references.json`, JSON.stringify({ "1.0.0": [OTHER_PROJECT] }));
    fs.setFile(`${OTHER_PROJECT}/marker`, OTHER_PROJECT_BYTES);
    const activator = new FakeHostActions({ available: true });
    const logger = new CapturingLogger();

    const useCase = buildUseCase({
      tools: registeredTools(),
      fs,
      manifest: seedManifest(
        TOOL.codex,
        [provenRegistration(TOOL.codex, "aidd-framework", "aidd-framework")],
        ["aidd-vcs@aidd-framework"]
      ),
      activator,
      binary: TOOL.codex,
      logger,
      aiddMarketplaceRegistry: seedSharedMarketplaceRegistry(),
    });

    await useCase.execute({
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(activator.uninstalledPlugins).not.toContain("aidd-vcs@aidd-framework");
    expect(fs.getFile(`${USER_CONFIG_DIR}/references.json`)).toContain(OTHER_PROJECT);
    expect(fs.getFile(`${OTHER_PROJECT}/marker`)).toBe(OTHER_PROJECT_BYTES);
    expect(
      logger.warnMessages.some((m) => m.includes("left enabled") && m.includes(OTHER_PROJECT))
    ).toBe(true);
  });
});
