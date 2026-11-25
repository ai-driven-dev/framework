import { rewritePluginRootToken } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";

/** The plugin-root variable a tool expands, written into content that names the source one. A
 * layout that substitutes nothing passes no token and the content is returned as it is. */
export function withRootToken(content: string, token: string | undefined): string {
  return token ? rewritePluginRootToken(content, token) : content;
}
