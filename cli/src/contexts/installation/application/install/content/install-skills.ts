import type { InstallationFile } from "../../../../../shared/domain/installation-file.js";
import type { SkillsSectionAnswers } from "../../../../tools/contract/tool-profile.js";
import type { ContentSection } from "../../../domain/canon.js";
import type { ContentSections } from "../../../ports/tool-sections.js";
import { type ContentSectionDescriptor, InstallContentSection } from "./install-content-section.js";

const skillsDescriptor: ContentSectionDescriptor<SkillsSectionAnswers> = {
  answersOf: (tool) => tool.skillsSection(),
  convertFrontmatter: (cap, frontmatter) => cap.convertFrontmatter(frontmatter),
};

interface InstallSkillsCommand {
  toolConfig: ContentSections;
  section: ContentSection;
  contentFiles: Map<string, string>;
}

export class InstallSkills {
  private readonly inner: InstallContentSection<SkillsSectionAnswers>;

  constructor(registeredSuffixes: readonly string[]) {
    this.inner = new InstallContentSection(skillsDescriptor, registeredSuffixes);
  }

  execute(options: InstallSkillsCommand): InstallationFile[] {
    return this.inner.execute(options);
  }
}
