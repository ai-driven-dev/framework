import type { InstallationFile } from "../../../../../shared/domain/file.js";
import type { Hasher } from "../../../../../shared/ports/hasher.js";
import type {
  AiToolProfile,
  SkillsSectionAnswers,
} from "../../../../tools/contract/tool-profile.js";
import type { ContentSection } from "../../../../translate/domain/canon.js";
import {
  type ContentSectionDescriptor,
  InstallContentSectionUseCase,
} from "./install-content-section-use-case.js";

const skillsDescriptor: ContentSectionDescriptor<SkillsSectionAnswers> = {
  answersOf: (tool) => tool.skillsSection(),
  convertFrontmatter: (cap, frontmatter) => cap.convertFrontmatter(frontmatter),
};

interface InstallSkillsOptions {
  toolConfig: AiToolProfile;
  section: ContentSection;
  contentFiles: Map<string, string>;
}

export class InstallSkillsUseCase {
  private readonly inner: InstallContentSectionUseCase<SkillsSectionAnswers>;

  constructor(hasher: Hasher) {
    this.inner = new InstallContentSectionUseCase(hasher, skillsDescriptor);
  }

  execute(options: InstallSkillsOptions): InstallationFile[] {
    return this.inner.execute(options);
  }
}
