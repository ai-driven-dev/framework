import { parseFrontmatter, serializeFrontmatter } from "../../../../shared/domain/markdown.js";

/** How a document's frontmatter is rewritten: the one shape every rule that touches a document's
 * header goes through, whichever layout asks. */
export interface FrontmatterShape {
  readonly frontmatter: (frontmatter: Record<string, unknown>) => Record<string, unknown>;
  /** The tool's own writer, for one that keeps its header in a form of its own. */
  readonly serialize?: (frontmatter: Record<string, unknown>, body: string) => string;
  /** `double` for a reader that keeps single quotes literally. */
  readonly quote?: "double";
}

export function reshapeFrontmatter(content: string, shape: FrontmatterShape): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const reshaped = shape.frontmatter(frontmatter);
  return shape.serialize
    ? shape.serialize(reshaped, body)
    : serializeFrontmatter(reshaped, body, shape.quote);
}
