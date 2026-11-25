/** Records one finding of the recipe being read; a line below 1 reads as the first. */
export type Report = (line: number, rule: string, fix: string) => void;

interface OpenFence {
  marker: string;
  length: number;
  start: number;
  language: string;
}
export interface Fence extends OpenFence {
  end: number;
  body: string;
}
interface FenceScan {
  fencedLines: Set<number>;
  blocks: Fence[];
}

const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})(.*)$/u;

interface FenceState extends FenceScan {
  readonly lines: string[];
  readonly report: Report;
  open: OpenFence | null;
}

function openFence(match: RegExpMatchArray, index: number, report: Report): OpenFence {
  const language = match[2].trim().split(/\s+/u)[0] ?? "";
  if (!language) {
    report(
      index + 1,
      "fence-language",
      "Add a language after the opening fence, such as ```bash or ```text."
    );
  }
  return {
    marker: match[1][0],
    length: match[1].length,
    start: index,
    language: language.toLowerCase(),
  };
}

function closesFence(match: RegExpMatchArray | null, open: OpenFence): boolean {
  return (
    match !== null &&
    match[1][0] === open.marker &&
    match[1].length >= open.length &&
    match[2].trim() === ""
  );
}

function scanLine(state: FenceState, index: number): void {
  const match = state.lines[index].match(FENCE_LINE);
  const { open } = state;
  if (open) {
    state.fencedLines.add(index);
    if (!closesFence(match, open)) return;
    state.blocks.push({
      ...open,
      end: index,
      body: state.lines.slice(open.start + 1, index).join("\n"),
    });
    state.open = null;
    return;
  }
  if (!match) return;
  state.open = openFence(match, index, state.report);
  state.fencedLines.add(index);
}

export function scanFences(lines: string[], report: Report): FenceScan {
  const state: FenceState = { lines, report, open: null, fencedLines: new Set(), blocks: [] };
  for (let index = 0; index < lines.length; index += 1) scanLine(state, index);
  if (state.open) {
    report(
      state.open.start + 1,
      "fence-balance",
      "Close this fenced code block with the same marker."
    );
  }
  return { fencedLines: state.fencedLines, blocks: state.blocks };
}
