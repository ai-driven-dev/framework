import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import type { NpmInstaller } from "../ports/npm-installer.js";

const execFile = promisify(execFileCb);

export class PnpmInstallerAdapter implements NpmInstaller {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async install(spec: string, prefix: string): Promise<void> {
    await execFile("pnpm", ["add", "--prefix", prefix, "--", spec], { env: this.env });
  }
}
