const FRONTMATTER_DELIMITER = "---";

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const lines = content.split("\n");

  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    return { frontmatter: {}, body: content };
  }

  const closingIndex = lines.slice(1).findIndex((l) => l.trim() === FRONTMATTER_DELIMITER);
  if (closingIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterLines = lines.slice(1, closingIndex + 1);
  const bodyLines = lines.slice(closingIndex + 2);

  const frontmatter = parseYamlLike(frontmatterLines);
  const body = bodyLines.join("\n");

  return { frontmatter, body };
}

export function serializeFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  if (Object.keys(frontmatter).length === 0) {
    return body;
  }

  const lines = [FRONTMATTER_DELIMITER];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${String(item)}`);
      }
    } else if (typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }

  lines.push(FRONTMATTER_DELIMITER);

  return `${lines.join("\n")}\n${body}`;
}

function parseYamlLike(lines: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of lines) {
    const listItemMatch = /^\s{2,}-\s+(.+)$/.exec(line);
    const keyValueMatch = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    const keyOnlyMatch = /^(\w[\w-]*):\s*$/.exec(line);

    if (listItemMatch && currentKey !== null) {
      if (currentList === null) {
        currentList = [];
        result[currentKey] = currentList;
      }
      currentList.push(listItemMatch[1].trim());
    } else if (keyOnlyMatch) {
      if (currentList !== null && currentKey !== null) {
        result[currentKey] = currentList;
      }
      currentKey = keyOnlyMatch[1];
      currentList = [];
      result[currentKey] = currentList;
    } else if (keyValueMatch) {
      if (currentList !== null && currentKey !== null) {
        result[currentKey] = currentList;
        currentList = null;
      }
      currentKey = keyValueMatch[1];
      const rawValue = keyValueMatch[2].trim();
      result[currentKey] = parseScalar(rawValue);
    }
  }

  return result;
}

function parseScalar(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}
