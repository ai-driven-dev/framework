import type {
  ProfileSectionKey,
  ProfileSections,
} from "../../../../src/contexts/tools/domain/profile.js";

/** The declared type of a tool that holds every section named in `K`. */
export type WithSections<K extends ProfileSectionKey> = Pick<Required<ProfileSections>, K>;
