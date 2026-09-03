/**
 * Vibe skill frontmatter: name + description, plus user-invocable so the skill
 * appears in the slash picker. Extra AIDD keys such as argument-hint are dropped.
 *
 * No inverse: the conversion is lossy. The Vibe-only user-invocable flag and any
 * stripped keys cannot be recovered from the output.
 */

export const MISTRAL_SKILL_USER_INVOCABLE_KEY = "user-invocable";

export function convertMistralSkillFrontmatter(
  fm: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (fm.name !== undefined) result.name = fm.name;
  if (fm.description !== undefined) result.description = fm.description;
  result[MISTRAL_SKILL_USER_INVOCABLE_KEY] = true;
  return result;
}
