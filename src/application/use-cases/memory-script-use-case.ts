import { join } from "node:path";
import type { FrameworkDescriptor } from "../../domain/models/framework-descriptor.js";
import { SCRIPT_UPDATE_MEMORY } from "../../domain/models/framework-descriptor.js";
import { GeneratedFile } from "../../domain/models/generated-file.js";
import type { Manifest } from "../../domain/models/manifest.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Git } from "../../domain/ports/git.js";
import type { Hasher } from "../../domain/ports/hasher.js";

export const SCRIPT_RELATIVE_PATH = ".aidd/scripts/update_memory.js";
const AIDD_HOOK_RELATIVE_PATH = ".aidd/hooks/pre-commit";
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
    private readonly git: Git
  ) {}

  async execute(options: MemoryScriptOptions): Promise<void> {
    const { projectRoot, version, descriptor, contentFiles, manifest } = options;
    const scriptRef = descriptor.getScript(SCRIPT_UPDATE_MEMORY);
    if (!scriptRef) return;
    const scriptContent = contentFiles.get(scriptRef.path);
    if (scriptContent === undefined) return;

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
      new GeneratedFile({ relativePath: SCRIPT_RELATIVE_PATH, content, hash }),
    ]);
  }

  private async installAiddHook(projectRoot: string, invocation: string): Promise<void> {
    const hookPath = join(projectRoot, AIDD_HOOK_RELATIVE_PATH);
    const content = `${HOOK_HEADER}\n${invocation} ${SCRIPT_RELATIVE_PATH}\n`;
    await this.fs.writeFile(hookPath, content);
    await this.fs.chmodExecutable(hookPath);
  }
}
