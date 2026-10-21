import { basename, dirname, join } from "node:path";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { AgentHost, AgentProvider } from "../../../tools/domain/formats/agent-models.js";
import {
  mainModelTarget,
  mainModelValues,
  planMainModelInstall,
  planMainModelRemoval,
} from "../../../tools/domain/formats/main-model-config.js";
import type { MainModelInstallations } from "../../domain/ports/agent-installation-store.js";
import { type AgentLocation, type AgentTarget, resolveAgentLocation } from "./agent-location.js";

/** A file's next content; null deletes it. */
export interface FileChange {
  path: string;
  content: string | null;
}

export async function readOptional(fs: FileReader, path: string): Promise<string | null> {
  return (await fs.fileExists(path)) ? fs.readFile(path) : null;
}

/** The provider's main model written into the host settings, recording what it replaces. */
export async function mainModelInstall(
  fs: FileReader & FileWriter,
  options: AgentTarget & { provider: AgentProvider },
  location: AgentLocation,
  mainModels: MainModelInstallations
): Promise<FileChange | null> {
  const target = mainModelTarget(options.host);
  const path = location.settingsPath;
  if (target === null || path === null) return null;
  await location.guard(path);
  if ((await fs.fileExists(path, false)) && !(await fs.fileExists(path)))
    throw new Error(`Settings link is broken; fix it before installing agents: ${path}`);
  const content = await readOptional(fs, path);
  for (const alternative of content === null ? (target.alternatives ?? []) : [])
    if (await fs.fileExists(join(dirname(path), alternative)))
      throw new Error(
        `Settings live in ${alternative}; move them to ${basename(path)} before installing agents.`
      );
  try {
    const plan = planMainModelInstall(
      content,
      target.format,
      mainModelValues(options.host, options.provider),
      mainModels[options.host]
    );
    mainModels[options.host] = plan.record;
    return { path, content: plan.content };
  } catch (error) {
    throw new Error(`Cannot set the main model in ${path}: ${(error as Error).message}`);
  }
}

/** The settings each recorded main model replaced, restored. */
export async function mainModelRemovals(
  fs: FileReader & FileWriter,
  target: Omit<AgentTarget, "host">,
  mainModels: MainModelInstallations,
  onlyHost?: AgentHost
): Promise<FileChange[]> {
  const changes: FileChange[] = [];
  for (const [host, record] of Object.entries(mainModels)) {
    if (onlyHost !== undefined && host !== onlyHost) continue;
    const settings = mainModelTarget(host as AgentHost);
    const location = resolveAgentLocation(fs, { ...target, host: host as AgentHost });
    if (settings === null || location.settingsPath === null || record === undefined) continue;
    await location.guard(location.settingsPath);
    const content = await readOptional(fs, location.settingsPath);
    const next = planMainModelRemoval(content, settings.format, record);
    if (next !== content) changes.push({ path: location.settingsPath, content: next });
  }
  return changes;
}
