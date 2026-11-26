import { reshapeFrontmatter } from "../../../../shared/domain/markdown.js";
import type { LinkSyntax } from "../../../../shared/domain/materialization/link-syntax.js";
import { basename } from "../../../../shared/domain/paths.model.js";
import type { PluginComponentFile } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { flatLinkTarget } from "../flat-layout.js";
import type { TranslatedAiTool } from "../translate-profile.js";
import type { ComponentPlan } from "./component-pipeline.js";
import { chainLinks, relativeLinks } from "./links.js";

/** A command named `<prefix><plugin>:<name>`, the name its source carries stripped of its own prefix. */
export function prefixCommandName(
  content: string,
  at: { source: string; prefix: string; pluginName: string }
): string {
  return reshapeFrontmatter(content, {
    frontmatter: (frontmatter) => {
      const rawName = typeof frontmatter.name === "string" ? frontmatter.name : "";
      const simpleName = stripCommandPrefix(rawName) || basename(at.source);
      return { ...frontmatter, name: `${at.prefix}${at.pluginName}:${simpleName}` };
    },
  });
}

function stripCommandPrefix(name: string): string {
  const match = /^aidd:\d+:(.+)$/.exec(name);
  if (match) return match[1];
  return name.slice(name.lastIndexOf(":") + 1);
}

/** A command in a flat layout, placed, named and linked the one way a build and an install share.
 * `target` is where a link's plugin-relative target lands: absent, a link stays as the tool writes it.
 *
 * Limit: a command's file name is its place, so two commands of one plugin that differ only by the
 * folder they sit in write one file. */
export function flatCommandPlan(
  { relativePath: source, content }: PluginComponentFile,
  at: {
    plugin: string;
    path: string;
    prefix: string;
    linkSyntax: LinkSyntax;
    target?: (pluginRelPath: string) => string;
  }
): ComponentPlan {
  const { plugin, path, prefix, linkSyntax, target } = at;
  return {
    source,
    path,
    content,
    links: chainLinks(
      { kind: "tool", syntax: linkSyntax },
      target === undefined ? undefined : relativeLinks(path, target)
    ),
    shape: (text) => prefixCommandName(text, { source, prefix, pluginName: plugin }),
  };
}

/** A command as the tool's install places it: named and linked as its build does when the build carries
 * commands, as the tool's profile says otherwise. */
export function installedCommandPlan(
  file: PluginComponentFile,
  at: { tool: TranslatedAiTool; pluginName: string },
  prefix: string
): ComponentPlan {
  const { tool, pluginName } = at;
  const contract = tool.buildContract("flat");
  const built = contract?.artifacts.commands;
  const carried = built?.supported ? built.commandMarkdown : null;
  return flatCommandPlan(file, {
    plugin: pluginName,
    path: tool.flatInstallPath("commands", pluginName, file.relativePath),
    prefix: carried?.namePrefix ?? prefix,
    linkSyntax: carried?.linkSyntax ?? tool.linkSyntax,
    target:
      contract !== null && built?.supported
        ? (rel) => flatLinkTarget(contract, pluginName, rel)
        : undefined,
  });
}
