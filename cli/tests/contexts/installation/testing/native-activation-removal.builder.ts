import type { Scope } from "../../../../src/shared/domain/scope.js";
import type { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import type { FakeHostActions } from "../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { FakeHostPluginRegistry } from "./fake-host-plugin-registry.fake.js";
import { PLUGIN_NAME, REF, verifiedSourceReader } from "./framework-plugin-on-claude.builder.js";
import { pluginRemover } from "./plugin-remover.builder.js";

const { claude } = TOOL;

export const NATIVE_PROJECT_ROOT = "/test-project";

export function buildRemoveUseCase(
  activator: FakeHostActions,
  logger: CapturingLogger,
  hostScope: Scope = "project"
): { removeUseCase: ReturnType<typeof pluginRemover>; manifestRepo: InMemoryManifestRepository } {
  const fs = new InMemoryFileAdapter();
  const manifestRepo = new InMemoryManifestRepository();
  const removeUseCase = pluginRemover({
    fs,
    manifestRepo,
    logger,
    activators: new Map([[claude, activator]]),
    hostPluginRegistries: new Map([
      [
        claude,
        new FakeHostPluginRegistry({
          location: "/host/plugin-registry",
          refs: new Map([
            [REF, { enabled: true, scope: hostScope }],
            [`${PLUGIN_NAME}@upstream`, { enabled: true, scope: "project" }],
          ]),
        }),
      ],
    ]),
    nativeMarketplaceSources: new Map([[claude, verifiedSourceReader()]]),
  });
  return { removeUseCase, manifestRepo };
}
