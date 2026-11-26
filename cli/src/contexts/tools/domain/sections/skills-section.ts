import { CapabilityConfigError } from "../../contract/errors/tools.error.js";

type SkillsSectionParams = {
  directory?: string;
  agentsSkillsDirectory?: boolean;
};

/** A tool that takes skills. What an install writes comes from the tool's marketplace contract. */
export class SkillsSection {
  constructor(params: SkillsSectionParams) {
    if (!params.agentsSkillsDirectory && !params.directory) {
      throw new CapabilityConfigError(
        "SkillsSection requires either agentsSkillsDirectory or directory"
      );
    }
  }
}
