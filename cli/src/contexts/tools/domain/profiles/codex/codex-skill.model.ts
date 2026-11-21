import { parseFrontmatter, serializeFrontmatter } from "../../../../../shared/domain/markdown.js";

export function stripCodexSkillFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (fm.name !== undefined) result.name = fm.name;
  if (fm.description !== undefined) result.description = fm.description;
  if (fm.allowed_tools !== undefined) result.allowed_tools = fm.allowed_tools;
  return result;
}

export function transformCodexSkill(content: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  return serializeFrontmatter(stripCodexSkillFrontmatter(frontmatter), body);
}
