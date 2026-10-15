import { join } from "node:path";
import { FileHash } from "../../../kernel/file.js";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../kernel/ports/file-writer.js";
import { isAgentHost } from "../../tools/domain/formats/agent-models.js";
import {
  AGENT_INSTALLATIONS_PATH,
  type AgentInstallationStore,
  type AgentInstallations,
} from "../domain/ports/agent-installation-store.js";

export class AgentInstallationStoreAdapter implements AgentInstallationStore {
  constructor(private readonly fs: FileReader & FileWriter) {}

  async load(projectRoot: string): Promise<AgentInstallations> {
    const path = join(projectRoot, AGENT_INSTALLATIONS_PATH);
    if (!(await this.fs.fileExists(path))) return {};
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
}
