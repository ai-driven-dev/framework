import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pluginClaimsFile } from "../../../../src/composition/machine-claims.js";
import { atomicWriteFile } from "../../../../src/shared/infrastructure/atomic-write.js";
import { resolveRegisteredToolId } from "../../../shared/testing/registered-tools.builder.js";
import { InMemoryPluginClaims } from "../testing/in-memory-plugin-claims.fake.js";
import {
  describePluginClaimsContract,
  type PluginClaimsSubject,
} from "../testing/plugin-claims-repository.contract.js";

describePluginClaimsContract(
  "in memory",
  async (): Promise<PluginClaimsSubject> => ({
    claims: new InMemoryPluginClaims(),
    dispose: async () => undefined,
  })
);

describePluginClaimsContract("in a file on a temp dir", async (): Promise<PluginClaimsSubject> => {
  const dir = await mkdtemp(join(tmpdir(), "aidd-plugin-claims-contract-"));
  return {
    claims: pluginClaimsFile(() => dir, {
      atomicWriter: atomicWriteFile,
      resolveToolId: resolveRegisteredToolId,
    }),
    dispose: () => rm(dir, { recursive: true, force: true }),
  };
});
