import { relative } from "node:path";

export interface CatalogFile {
  readonly frameworkPath: string;
  readonly installedPath: string;
  readonly toolId: string;
  readonly frontmatter: Record<string, unknown>;
}

const HEADER =
  "# AIDD Framework Catalog\n\nAuto-generated framework content: agents, commands, rules, skills, and templates.\n\n> This file is automatically updated by `aidd`.\n\n";

const SKIP_FM_KEYS = new Set(["name", "model"]);

export function generateCatalogContent(files: CatalogFile[], docsDir: string): string {
  if (files.length === 0) {
    return `${HEADER}No content installed.`;
  }

  const sections = groupBySection(files);
  const sortedSections = [...sections.keys()].sort();

  let sectionsContent = "";
  for (const section of sortedSections) {
    sectionsContent += generateSection(section, sections.get(section)!, docsDir);
  }

  const toc = generateToc(sectionsContent);
  return `${HEADER}## Table of Contents\n\n${toc}\n\n---\n\n${sectionsContent}`;
}

function groupBySection(files: CatalogFile[]): Map<string, CatalogFile[]> {
  const sections = new Map<string, CatalogFile[]>();
  for (const file of files) {
    const section = file.frameworkPath.split("/")[0] ?? "other";
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section)!.push(file);
  }
  return sections;
}

function generateSection(section: string, files: CatalogFile[], docsDir: string): string {
  // Strip the first path component (section name) to get relative paths within section
  const sectionFiles = files.map((f) => ({
    ...f,
    pathInSection: f.frameworkPath.slice(section.length + 1),
  }));

  const subgroups = groupBySubfolder(sectionFiles);
  const sortedSubgroups = [...subgroups.keys()].sort((a, b) => {
    if (a === "_root") return -1;
    if (b === "_root") return 1;
    return a.localeCompare(b);
  });

  if (sortedSubgroups.length === 1 && sortedSubgroups[0] === "_root") {
    return `### \`${section}\`\n\n${generateTable(subgroups.get("_root")!, docsDir)}\n`;
  }

  let content = `### \`${section}\`\n\n`;
  for (const subgroup of sortedSubgroups) {
    const groupFiles = subgroups.get(subgroup)!;
    if (subgroup === "_root") {
      content += `${generateTable(groupFiles, docsDir)}\n`;
    } else {
      content += `#### \`${section}/${subgroup}\`\n\n${generateTable(groupFiles, docsDir)}\n`;
    }
  }
  return content;
}

function groupBySubfolder(
  files: Array<CatalogFile & { pathInSection: string }>
): Map<string, Array<CatalogFile & { pathInSection: string }>> {
  const groups = new Map<string, Array<CatalogFile & { pathInSection: string }>>();
  for (const file of files) {
    const parts = file.pathInSection.split("/");
    const subfolder = parts.length > 1 ? parts[0] : "_root";
    if (!groups.has(subfolder)) groups.set(subfolder, []);
    groups.get(subfolder)!.push(file);
  }
  return groups;
}

function generateTable(
  files: Array<CatalogFile & { pathInSection: string }>,
  docsDir: string
): string {
  // Group entries by frameworkPath so the same file across multiple tools appears on one row
  const grouped = new Map<string, Array<CatalogFile & { pathInSection: string }>>();
  for (const file of files) {
    if (!grouped.has(file.frameworkPath)) grouped.set(file.frameworkPath, []);
    grouped.get(file.frameworkPath)!.push(file);
  }

  const multiTool = [...grouped.values()].some((entries) => entries.length > 1);

  const allKeys = new Set<string>();
  for (const file of files) {
    for (const key of Object.keys(file.frontmatter)) {
      if (!SKIP_FM_KEYS.has(key)) allKeys.add(key);
    }
  }

  const extraColumns = [...allKeys];
  const formatHeader = (k: string): string =>
    k.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const installedHeader = multiTool ? " Installed |" : "";
  const installedSep = multiTool ? "---|" : "";
  const colHeaders =
    extraColumns.length > 0 ? ` ${extraColumns.map(formatHeader).join(" | ")} |` : "";
  const colSepSuffix = extraColumns.length > 0 ? `${extraColumns.map(() => "---").join("|")}|` : "";

  let table = `| File |${installedHeader}${colHeaders}\n`;
  table += `|------|${installedSep}${colSepSuffix}\n`;

  for (const [, entries] of grouped) {
    const representative = entries[0]!;
    const label = representative.frameworkPath.split("/").at(-1) ?? representative.frameworkPath;

    const fileCell = multiTool
      ? label
      : `[${label}](${relative(docsDir, representative.installedPath)})`;

    const installedCell = multiTool
      ? ` ${entries.map((e) => `[${e.toolId}](${relative(docsDir, e.installedPath)})`).join(" · ")} |`
      : "";

    const values = extraColumns.map((key) => {
      const val = representative.frontmatter[key];
      return val !== undefined && val !== null && val !== "N/A" ? `\`${String(val)}\`` : "-";
    });
    const valCells = values.length > 0 ? ` ${values.join(" | ")} |` : "";
    table += `| ${fileCell} |${installedCell}${valCells}\n`;
  }

  return table;
}

function generateToc(markdown: string): string {
  const tocLines: string[] = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^(#{3,4})\s+(.+)/);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].trim().replace(/`/g, "");
    const anchor = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    const indent = "  ".repeat(level - 3);
    tocLines.push(`${indent}- [${text}](#${anchor})`);
  }
  return tocLines.join("\n");
}
