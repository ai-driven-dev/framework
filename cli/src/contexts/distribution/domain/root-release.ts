/** Root release tag: `v` followed by a digit (`v4.0.0`, `v3.7.3-pm.1`). Release-please's
 * per-component tags are not install units: the marketplace manifest lives at the repository root. */
const ROOT_RELEASE_TAG_REGEX = /^v\d/;

/** The root release tags among `tags`, in the order given (the forge lists newest first). */
export function rootReleaseTags(tags: readonly string[]): string[] {
  return tags.filter((tag) => ROOT_RELEASE_TAG_REGEX.test(tag));
}
