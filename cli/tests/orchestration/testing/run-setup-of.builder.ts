import type { RegisteredCatalog } from "../../../src/composition/contexts/tools.js";
import type { DetectProjectContext } from "../../../src/contexts/installation/application/detect-project-context.use-case.js";
import { InitProject } from "../../../src/contexts/installation/application/init-project.use-case.js";
import type { InstallTools } from "../../../src/contexts/installation/application/install/install-tools.use-case.js";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import type { ManifestRepository } from "../../../src/contexts/installation/ports/manifest-repository.js";
import type { ResolveSetupSource } from "../../../src/orchestration/setup/resolve-setup-source.use-case.js";
import { RunSetup } from "../../../src/orchestration/setup/run-setup.use-case.js";
import type { RegisterFrameworkSource } from "../../../src/orchestration/setup/setup-flow.js";
import type { SetupMachineScope } from "../../../src/orchestration/setup/setup-machine-scope.use-case.js";
import type { ChoosePlugins } from "../../../src/orchestration/setup/steps/choose-plugins.use-case.js";
import type { ChooseTools } from "../../../src/orchestration/setup/steps/choose-tools.use-case.js";
import { InstallSetupTools } from "../../../src/orchestration/setup/steps/install-setup-tools.use-case.js";
import { PrepareSetupProject } from "../../../src/orchestration/setup/steps/prepare-setup-project.use-case.js";
import type { SyncSettings } from "../../../src/orchestration/sync/settings/sync-settings.use-case.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../src/shared/ports/file-writer.js";

/** The setup scenario as composition wires it: prepare the project, install the tools, ask about
 * plugins, sync settings. */
export function runSetupOf(parts: {
  tools: RegisteredCatalog;
  fs: FileReader & FileWriter;
  manifestRepo: ManifestRepository;
  resolveSource: Pick<ResolveSetupSource, "execute">;
  register: RegisterFrameworkSource;
  installTools: Pick<InstallTools, "execute">;
  chooseTools?: Pick<ChooseTools, "execute">;
  choosePlugins: Pick<ChoosePlugins, "execute">;
  syncSettings: Pick<SyncSettings, "execute">;
  version: string;
  detectContext?: Pick<DetectProjectContext, "execute">;
  machineScope?: Pick<SetupMachineScope, "execute">;
}): RunSetup {
  const { tools, fs, manifestRepo } = parts;
  return new RunSetup(
    new PrepareSetupProject(
      parts.detectContext,
      parts.resolveSource,
      new InitProject({ fs, manifestRepo, updateGitignore: new UpdateGitignore(fs) }, tools),
      parts.register
    ),
    new InstallSetupTools(parts.installTools, parts.chooseTools, parts.version),
    parts.choosePlugins,
    parts.syncSettings,
    parts.machineScope
  );
}
