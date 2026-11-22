import { RegisteredToolCatalog } from "../../../../src/contexts/tools/application/registered-tool-catalog.js";
import type { AiToolProfile } from "../../../../src/contexts/tools/contract/tool-profile.js";
import { anEmptyContract } from "../../../shared/testing/empty-build-contract.builder.js";
import {
  SYNTHETIC_TOOL,
  syntheticConfig,
} from "../../../shared/testing/synthetic-tool-id.builder.js";
import { contractToolProfile, type ProfileAnswers } from "./contract-tool-profile.builder.js";
import { flatPluginsStub } from "./flat-plugins-stub.builder.js";

const BASE = new RegisteredToolCatalog([syntheticConfig("synthetic")]).aiProfile(SYNTHETIC_TOOL);

/** A tool of its own: no section, a flat plugin refusing hooks, an empty flat contract, its files
 * under `.fake/`, nothing a registered tool declares but what the answers give it. */
export function syntheticToolProfile(answers: ProfileAnswers = {}): AiToolProfile {
  const directory = answers.directory ?? ".fake/";
  return contractToolProfile(BASE, {
    directory,
    plugins: flatPluginsStub(),
    flatContract: anEmptyContract(),
    flatInstallPath: (section, pluginName, fileName) =>
      `${directory}${section}/${pluginName}/${fileName}`,
    linkSyntax: [],
    ...answers,
    sections: { commands: null, agents: null, rules: null, skills: null, ...answers.sections },
  });
}
