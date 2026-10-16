import type { FileHash } from "../../../../kernel/file.js";
import type { AgentHost } from "../../../tools/domain/formats/agent-models.js";

export type AgentInstallations = Partial<Record<AgentHost, Record<string, FileHash>>>;

export interface AgentInstallationStore {
  withExclusiveAccess<T>(projectRoot: string, action: () => Promise<T>): Promise<T>;
  load(projectRoot: string): Promise<AgentInstallations>;
  save(projectRoot: string, installations: AgentInstallations): Promise<void>;
}

export const AGENT_INSTALLATIONS_PATH = ".aidd/agents.json";
export const AGENT_INSTALLATIONS_LOCK_PATH = `${AGENT_INSTALLATIONS_PATH}.lock`;
