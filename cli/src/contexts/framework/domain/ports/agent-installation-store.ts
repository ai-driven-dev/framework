import type { FileHash } from "../../../../kernel/file.js";
import type { AgentHost } from "../../../tools/domain/formats/agent-models.js";
import type { MainModelRecord } from "../../../tools/domain/formats/main-model-config.js";

export type AgentInstallations = Partial<Record<AgentHost, Record<string, FileHash>>>;

/** Main-session settings AIDD wrote per host, so removal restores what was there before. */
export type MainModelInstallations = Partial<Record<AgentHost, MainModelRecord>>;

export interface AgentInstallationStore {
  withExclusiveAccess<T>(projectRoot: string, action: () => Promise<T>): Promise<T>;
  load(projectRoot: string): Promise<AgentInstallations>;
  save(projectRoot: string, installations: AgentInstallations): Promise<void>;
  loadMainModels(projectRoot: string): Promise<MainModelInstallations>;
  saveMainModels(projectRoot: string, installations: MainModelInstallations): Promise<void>;
}

export const AGENT_INSTALLATIONS_PATH = ".aidd/agents.json";
export const MAIN_MODEL_INSTALLATIONS_PATH = ".aidd/main-model.json";
export const AGENT_INSTALLATIONS_LOCK_PATH = `${AGENT_INSTALLATIONS_PATH}.lock`;
