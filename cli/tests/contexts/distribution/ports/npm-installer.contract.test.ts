import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe } from "vitest";
import { PnpmInstallerAdapter } from "../../../../src/contexts/distribution/infrastructure/pnpm-installer-adapter.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";
import {
  describeNpmInstallerContract,
  type NpmInstallerSubject,
  SERVED_PACKAGE,
} from "../testing/npm-installer.contract.js";
import { FakeNpmInstaller } from "../testing/npm-installer.fake.js";
import { aStubPnpm } from "../testing/stub-pnpm.builder.js";

async function prefix(): Promise<{ dir: string; dispose: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "aidd-npm-prefix-"));
  return { dir, dispose: () => rm(dir, { recursive: true, force: true }) };
}

describeNpmInstallerContract("by the fake", async () => {
  const where = await prefix();
  return {
    installer: new FakeNpmInstaller(new FileAdapter(), [SERVED_PACKAGE]),
    prefix: where.dir,
    dispose: where.dispose,
  } satisfies NpmInstallerSubject;
});

describe.skipIf(process.platform === "win32")("with a pnpm script", () => {
  describeNpmInstallerContract("by PnpmInstallerAdapter over a stub pnpm", async () => {
    const [where, pnpm] = await Promise.all([prefix(), aStubPnpm(SERVED_PACKAGE)]);
    return {
      installer: new PnpmInstallerAdapter(pnpm.env),
      prefix: where.dir,
      dispose: async () => {
        await where.dispose();
        await pnpm.dispose();
      },
    } satisfies NpmInstallerSubject;
  });
});
