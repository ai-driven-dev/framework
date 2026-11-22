import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PnpmInstallerAdapter } from "../../../../src/contexts/distribution/infrastructure/pnpm-installer-adapter.js";
import { aStubPnpm } from "../testing/stub-pnpm.builder.js";

describe.skipIf(process.platform === "win32")("PnpmInstallerAdapter", () => {
  it("passes a spec that looks like an option after --, so it is a package and never a flag", async () => {
    const pnpm = await aStubPnpm("served");
    const prefix = await mkdtemp(join(tmpdir(), "aidd-npm-prefix-"));
    try {
      await new PnpmInstallerAdapter(pnpm.env).install("--registry=https://evil.test@1", prefix);

      expect(existsSync(join(prefix, "node_modules", "--registry=https://evil.test"))).toBe(true);
    } finally {
      await pnpm.dispose();
      await rm(prefix, { recursive: true, force: true });
    }
  });

  it("names what pnpm said when it fails", async () => {
    const pnpm = await aStubPnpm("served");
    try {
      await expect(
        new PnpmInstallerAdapter(pnpm.env).install("absent@1", "/unused")
      ).rejects.toThrow(/ERR_PNPM_FETCH_404 absent/);
    } finally {
      await pnpm.dispose();
    }
  });
});
