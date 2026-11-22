import { join } from "node:path";
import type { NpmInstaller } from "../../../../src/contexts/distribution/ports/npm-installer.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";

/** An npm that holds the packages it was given and writes each into the prefix it is asked for. */
export class FakeNpmInstaller implements NpmInstaller {
  /** Every install asked for, in order. */
  readonly installs: { spec: string; prefix: string }[] = [];

  constructor(
    private readonly fs: FileWriter,
    private readonly held: readonly string[]
  ) {}

  async install(spec: string, prefix: string): Promise<void> {
    this.installs.push({ spec, prefix });
    const name = spec.slice(0, spec.lastIndexOf("@"));
    if (!this.held.includes(name)) throw new Error(`ERR_PNPM_FETCH_404 ${name}`);
    await this.fs.writeFile(join(prefix, "node_modules", name, "package.json"), "{}");
  }
}
