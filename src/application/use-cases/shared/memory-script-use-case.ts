import { join } from "node:path";
import { type FileHash, InstallationFile } from "../../../domain/models/file.js";
import {
  type FrameworkDescriptor,
  SCRIPT_UPDATE_MEMORY,
} from "../../../domain/models/framework.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import { AIDD_DIR } from "../../../domain/models/paths.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import type { VersionControl } from "../../../domain/ports/version-control.js";

export const SCRIPT_RELATIVE_PATH = `${AIDD_DIR}/scripts/update_memory.js`;
const AIDD_HOOK_RELATIVE_PATH = `${AIDD_DIR}/hooks/pre-commit`;
const HOOK_HEADER = "#!/bin/sh";

interface MemoryScriptOptions {
  projectRoot: string;
  version: string;
  descriptor: FrameworkDescriptor;
  contentFiles: Map<string, string>;
  manifest: Manifest;
}

export class MemoryScriptUseCase {
  constructor(
    private readonly fs: FileSystem,
    private readonly hasher: Hasher,
    private readonly git: VersionControl,
    private readonly prompter?: Prompter
  ) {}

  async execute(options: MemoryScriptOptions): Promise<void> {
    const { projectRoot, version, descriptor, contentFiles, manifest } = options;
    const scriptRef = descriptor.getScript(SCRIPT_UPDATE_MEMORY);
    if (!scriptRef) return;
    const scriptContent = contentFiles.get(scriptRef.path);
    if (scriptContent === undefined) return;

    await this.cleanupStaleScripts(projectRoot, manifest);

    const newHash = this.hasher.hash(scriptContent);
    const storedFile = manifest
      .getScriptsFiles()
      .find((f) => f.relativePath === SCRIPT_RELATIVE_PATH);
    if (!storedFile || storedFile.hash.value !== newHash.value) {
      await this.writeScript(projectRoot, version, scriptContent, manifest);
    }
    await this.installAiddHook(projectRoot, scriptRef.invocation);
    await this.git.installPreCommitDelegate(projectRoot, AIDD_HOOK_RELATIVE_PATH);
  }

  private async cleanupStaleScripts(projectRoot: string, manifest: Manifest): Promise<void> {
    for (const storedFile of manifest.getScriptsFiles()) {
      if (storedFile.relativePath === SCRIPT_RELATIVE_PATH) continue;
      await this.deleteStaleScript(projectRoot, storedFile.relativePath, storedFile.hash);
    }
  }

  private async deleteStaleScript(
    projectRoot: string,
    relativePath: string,
    hash: FileHash
  ): Promise<void> {
    const absolutePath = join(projectRoot, relativePath);
    const isModified = await this.fs.hasLocalChanges(absolutePath, hash);
    if (isModified && this.prompter !== undefined) {
      const confirmed = await this.prompter.confirm(
        `Stale script \`${relativePath}\` was locally modified. Delete it?`
      );
      if (!confirmed) return;
    }
    await this.fs.deleteFile(absolutePath);
  }

  private async writeScript(
    projectRoot: string,
    version: string,
    content: string,
    manifest: Manifest
  ): Promise<void> {
    const scriptPath = join(projectRoot, SCRIPT_RELATIVE_PATH);
    await this.fs.writeFile(scriptPath, content);
    const hash = await this.fs.readFileHash(scriptPath);
    manifest.addScripts(version, [
      new InstallationFile({ relativePath: SCRIPT_RELATIVE_PATH, content, hash }),
    ]);
  }

  private async installAiddHook(projectRoot: string, invocation: string): Promise<void> {
    const hookPath = join(projectRoot, AIDD_HOOK_RELATIVE_PATH);
    const content = `${HOOK_HEADER}\n${invocation} ${SCRIPT_RELATIVE_PATH}\n`;
    await this.fs.writeFile(hookPath, content);
    await this.fs.chmodExecutable(hookPath);
  }
}
