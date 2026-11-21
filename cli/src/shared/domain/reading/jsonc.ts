function endOfLineComment(content: string, from: number): number {
  let i = from;
  while (i < content.length && content[i] !== "\n") i++;
  return i;
}

function endOfBlockComment(content: string, from: number): number {
  let i = from + 2;
  while (i < content.length && !(content[i] === "*" && content[i + 1] === "/")) i++;
  return i + 2;
}

function isTrailingComma(content: string, commaAt: number): boolean {
  let j = commaAt + 1;
  while (j < content.length && " \t\n\r".includes(content[j])) j++;
  return content[j] === "}" || content[j] === "]";
}

/** The text of a string literal from its opening quote, escapes kept, and where it ends. */
function readStringLiteral(content: string, from: number): { text: string; end: number } {
  let i = from + 1;
  while (i < content.length && content[i] !== '"') i += content[i] === "\\" ? 2 : 1;
  const end = Math.min(i + 1, content.length);
  return { text: content.slice(from, end), end };
}

// No inverse: stripJsonComments is lossy: stripped comments are not recoverable.
export function stripJsonComments(content: string): string {
  let result = "";
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];
    if (ch === '"') {
      const { text, end } = readStringLiteral(content, i);
      result += text;
      i = end;
    } else if (ch === "/" && next === "/") {
      i = endOfLineComment(content, i);
    } else if (ch === "/" && next === "*") {
      i = endOfBlockComment(content, i);
    } else if (ch === "," && isTrailingComma(content, i)) {
      i++;
    } else {
      result += ch;
      i++;
    }
  }
  return result;
}
