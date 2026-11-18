import type { AiToolProfile } from "../../../../src/contexts/tools/contract/tool-profile.js";
import { anEmptyContract } from "../../../shared/testing/empty-build-contract.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.js";
import { contractToolProfile, type ProfileAnswers } from "./contract-tool-profile.js";
import { flatPluginsStub } from "./flat-plugins-stub.js";

/** A tool of its own: no section, a flat plugin refusing hooks, an empty flat contract, its files
 * under `.fake/`, nothing a registered tool declares but what the answers give it. */
export function syntheticToolProfile(answers: ProfileAnswers = {}): AiToolProfile {
  const directory = answers.directory ?? ".fake/";
  return contractToolProfile(registeredTools().aiProfile(TOOL.claude), {
    directory,
    plugins: flatPluginsStub(),
    flatContract: anEmptyContract(),
    flatInstallPath: (section, pluginName, fileName) =>
      `${directory}${section}/${pluginName}/${fileName}`,
    rewriteContent: (content) => content,
    ...answers,
    sections: { commands: null, agents: null, rules: null, skills: null, ...answers.sections },
  });
}
