import {
  AT_DOCS_PLACEHOLDER,
  AT_TOOLS_PLACEHOLDER,
  DOCS_PLACEHOLDER,
  TOOLS_PLACEHOLDER,
} from "../models/framework.js";

export function baseRewriteContent(content: string, directory: string, docsDir: string): string {
  return content
    .replaceAll(AT_TOOLS_PLACEHOLDER, `@${directory}`)
    .replaceAll(AT_DOCS_PLACEHOLDER, `@${docsDir}/`)
    .replaceAll(TOOLS_PLACEHOLDER, directory)
    .replaceAll(DOCS_PLACEHOLDER, `${docsDir}/`);
}

export function baseReverseRewriteContent(
  content: string,
  directory: string,
  docsDir: string
): string {
  return content
    .replaceAll(`@${directory}`, AT_TOOLS_PLACEHOLDER)
    .replaceAll(`@${docsDir}/`, AT_DOCS_PLACEHOLDER)
    .replaceAll(directory, TOOLS_PLACEHOLDER)
    .replaceAll(`${docsDir}/`, DOCS_PLACEHOLDER);
}
