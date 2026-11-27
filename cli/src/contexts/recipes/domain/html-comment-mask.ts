interface MaskedLine {
  readonly text: string;
  readonly commentOpen: boolean;
}

interface CommentSpan {
  readonly start: number;
  readonly limit: number;
  readonly unclosed: boolean;
}

function nextComment(line: string, position: number, open: boolean): CommentSpan | null {
  const start = open ? position : line.indexOf("<!--", position);
  if (start === -1) return null;
  const close = line.indexOf("-->", open ? start : start + 4);
  return { start, limit: close === -1 ? line.length : close + 3, unclosed: close === -1 };
}

function maskLineComments(line: string, commentOpen: boolean): MaskedLine {
  let text = "";
  let position = 0;
  let open = commentOpen;
  while (position < line.length) {
    const comment = nextComment(line, position, open);
    if (!comment) return { text: text + line.slice(position), commentOpen: open };
    text += line.slice(position, comment.start);
    text += line.slice(comment.start, comment.limit).replace(/./gu, " ");
    open = comment.unclosed;
    position = comment.limit;
  }
  return { text, commentOpen: open };
}

interface MaskState {
  fence: { marker: string; length: number } | null;
  commentOpen: boolean;
}

function closesFence(line: string, fence: { marker: string; length: number }): boolean {
  const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/u);
  return close !== null && close[1][0] === fence.marker && close[1].length >= fence.length;
}

function maskLine(line: string, state: MaskState): string {
  if (state.fence) {
    if (closesFence(line, state.fence)) state.fence = null;
    return line;
  }
  const masked = maskLineComments(line, state.commentOpen);
  state.commentOpen = masked.commentOpen;
  const open = masked.text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
  if (open) state.fence = { marker: open[1][0], length: open[1].length };
  return masked.text;
}

/** The content with every HTML comment blanked to spaces, line and column positions kept. A
 * comment-like text inside a fenced block is an example, not a comment, and stays as written. */
export function maskHtmlComments(content: string): string {
  const state: MaskState = { fence: null, commentOpen: false };
  return content
    .split("\n")
    .map((line) => maskLine(line, state))
    .join("\n");
}
