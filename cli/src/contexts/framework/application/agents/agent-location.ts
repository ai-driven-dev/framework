import { basename, join } from "node:path";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { AgentsCapability } from "../../../tools/domain/capabilities/agents-capability.js";
import type { EnvironmentReader } from "../../../tools/domain/capabilities/plugins-capability.js";
import type { HasAgents } from "../../../tools/domain/contracts.js";
import type { AgentHost } from "../../../tools/domain/formats/agent-models.js";
import { mainModelTarget } from "../../../tools/domain/formats/main-model-config.js";
import { getAiToolConfig } from "../../../tools/domain/registry.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";

/** The user's home, environment and AIDD configuration directory, for user-scoped agents. */
export interface UserAgentRoot {
  home: string;
  env: EnvironmentReader;
  configDir: string;
}

export interface AgentTarget {
  projectRoot: string;
  host: AgentHost;
  /** Targets the IDE's user configuration directory instead of the project. */
  user?: UserAgentRoot;
}

/** Where one host's agents, main settings and ownership registry live for a scope. */
export interface AgentLocation {
  registryRoot: string;
  /** Creates the registry root when the scope owns it. */
  prepare?: () => Promise<void>;
  agentPath(name: string): string;
  settingsPath: string | null;
  guard(path: string): Promise<void>;
}

export function agentsCapability(host: AgentHost): AgentsCapability {
  return (getAiToolConfig(host).capabilities as HasAgents).agents;
}

export function resolveAgentLocation(
  fs: FileReader & FileWriter,
  target: AgentTarget
): AgentLocation {
  const capability = agentsCapability(target.host);
  const settings = mainModelTarget(target.host);
  const file = (name: string) => {
    const path = capability.buildInstallPath(`${name}.md`);
    if (path === null) throw new Error(`Agent ${name} has no native install path.`);
    return path;
  };
  const user = target.user;
  if (user === undefined) {
    const root = target.projectRoot;
    return {
      registryRoot: root,
      agentPath: (name) => join(root, file(name)),
      settingsPath: settings === null ? null : join(root, settings.path),
      guard: (path) => assertProjectPathWithinRoot(fs, root, path),
    };
  }
  const directory = capability.params.userDirectory?.(user.home, user.env);
  if (directory === undefined) throw new Error(`${target.host} has no user-level agents.`);
  const configDir = user.configDir;
  return {
    registryRoot: configDir,
    prepare: () => fs.createDirectory(configDir),
    agentPath: (name) => join(directory, "agents", basename(file(name))),
    settingsPath: settings === null ? null : join(directory, settings.userPath),
    guard: async () => {},
  };
}
