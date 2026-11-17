/**
 * The few text readings the architecture tests share: they see source as text, so a comma or a
 * bracket inside a comment must never be read as code. A string or a regular expression holding
 * one is a limit: no constructor of the tree has one.
 */

/** A block or a line comment. */
const COMMENTS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;

/** The code with comments dropped, so none adds a comma or a bracket. */
export function codeOnly(source: string): string {
  return source.replace(COMMENTS, "");
}

/** The index of the bracket closing the one at `open`, counting every kind and skipping `=>`. */
export function closingBracket(text: string, open: number): number {
  let depth = 0;
  for (let at = open; at < text.length; at++) {
    if (text[at] === "=" && text[at + 1] === ">") at++;
    else if ("([{<".includes(text[at] as string)) depth++;
    else if (")]}>".includes(text[at] as string) && --depth === 0) return at;
  }
  return text.length;
}

/** The pieces of `text` between the commas that sit outside every bracket. */
export function topLevelPieces(text: string): string[] {
  const pieces: string[] = [];
  let depth = 0;
  let from = 0;
  for (let at = 0; at < text.length; at++) {
    if (text[at] === "=" && text[at + 1] === ">") at++;
    else if ("([{<".includes(text[at] as string)) depth++;
    else if (")]}>".includes(text[at] as string)) depth--;
    else if (text[at] === "," && depth === 0) {
      pieces.push(text.slice(from, at));
      from = at + 1;
    }
  }
  pieces.push(text.slice(from));
  return pieces.map((piece) => piece.trim()).filter(Boolean);
}
