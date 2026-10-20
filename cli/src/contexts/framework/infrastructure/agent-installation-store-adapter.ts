import { mkdir, rmdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { FileHash } from "../../../kernel/file.js";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../kernel/ports/file-writer.js";
import { isAgentHost } from "../../tools/domain/formats/agent-models.js";
import {
  AGENT_INSTALLATIONS_LOCK_PATH,
  AGENT_INSTALLATIONS_PATH,
  type AgentInstallationStore,
  type AgentInstallations,
  MAIN_MODEL_INSTALLATIONS_PATH,
  type MainModelInstallations,
} from "../domain/ports/agent-installation-store.js";

export class AgentInstallationStoreAdapter implements AgentInstallationStore {
  constructor(private readonly fs: FileReader & FileWriter) {}

  async withExclusiveAccess<T>(projectRoot: string, action: () => Promise<T>): Promise<T> {
    const lock = join(projectRoot, AGENT_INSTALLATIONS_LOCK_PATH);
    const deadline = Date.now() + 30_000;
    while (true) {
      try {
        await mkdir(dirname(lock), { recursive: true });
        await mkdir(lock);
        break;
      } catch (error) {
        if (!["EEXIST", "ENOENT"].includes((error as NodeJS.ErrnoException).code ?? ""))
          throw error;
        if (Date.now() >= deadline)
          throw new Error(
            `Agent ownership registry is busy: ${lock}. Retry after the other AIDD operation finishes; remove this lock only if that operation has stopped.`
          );
        await pause(50);
      }
    }
    try {
      return await action();
    } finally {
      await this.release(lock);
    }
  }

  private async release(lock: string): Promise<void> {
    await rmdir(lock);
    try {
      await rmdir(dirname(lock));
    } catch (error) {
      if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes((error as NodeJS.ErrnoException).code ?? ""))
        throw error;
    }
  }

  async load(projectRoot: string): Promise<AgentInstallations> {
    const path = join(projectRoot, AGENT_INSTALLATIONS_PATH);
    if (!(await this.fs.fileExists(path, false))) return {};
    const parsed: unknown = JSON.parse(await this.fs.readFile(path));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      throw new Error(`Invalid agent ownership file: ${path}`);
    const installations: AgentInstallations = {};
    for (const [host, entries] of Object.entries(parsed)) {
      if (
        !isAgentHost(host) ||
        typeof entries !== "object" ||
        entries === null ||
        Array.isArray(entries)
      )
        throw new Error(`Invalid agent ownership file: ${path}`);
      installations[host] = Object.fromEntries(
        Object.entries(entries).map(([name, hash]) => {
          if (typeof hash !== "string") throw new Error(`Invalid agent hash: ${name}`);
          return [name, new FileHash(hash)];
        })
      );
    }
    return installations;
  }

  async save(projectRoot: string, installations: AgentInstallations): Promise<void> {
    const path = join(projectRoot, AGENT_INSTALLATIONS_PATH);
    if (Object.keys(installations).length === 0) {
      await this.fs.deleteFile(path);
      if (await this.fs.fileExists(path))
        throw new Error(`Could not remove agent ownership file: ${path}`);
      return;
    }
    const data = Object.fromEntries(
      Object.entries(installations).map(([host, entries]) => [
        host,
        Object.fromEntries(Object.entries(entries).map(([name, hash]) => [name, hash.value])),
      ])
    );
    await this.fs.writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
  }

  async loadMainModels(projectRoot: string): Promise<MainModelInstallations> {
    const path = join(projectRoot, MAIN_MODEL_INSTALLATIONS_PATH);
    if (!(await this.fs.fileExists(path, false))) return {};
    const parsed: unknown = JSON.parse(await this.fs.readFile(path));
    const invalid = new Error(`Invalid main model ownership file: ${path}`);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw invalid;
    const installations: MainModelInstallations = {};
    const strings = (value: unknown, nullable = false) =>
      typeof value === "object" &&
      value !== null &&
      Object.values(value).every(
        (entry) => typeof entry === "string" || (nullable && entry === null)
      );
    for (const [host, record] of Object.entries(parsed)) {
      if (
        !isAgentHost(host) ||
        !strings(record?.written) ||
        !strings(record?.previous, true) ||
        typeof record?.created !== "boolean"
      )
        throw invalid;
      installations[host] = record;
    }
    return installations;
  }

  async saveMainModels(projectRoot: string, installations: MainModelInstallations): Promise<void> {
    const path = join(projectRoot, MAIN_MODEL_INSTALLATIONS_PATH);
    if (Object.keys(installations).length > 0) {
      await this.fs.writeFile(path, `${JSON.stringify(installations, null, 2)}\n`);
      return;
    }
    if (!(await this.fs.fileExists(path, false))) return;
    await this.fs.deleteFile(path);
    if (await this.fs.fileExists(path))
      throw new Error(`Could not remove main model ownership file: ${path}`);
  }
}
