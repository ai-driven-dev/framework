const B = "\x1b[38;2;78;78;249m"; // primary — AIDD blue #4E4EF9
const P = "\x1b[38;2;221;84;117m"; // glitch only — pink #DD5475
const G = "\x1b[38;2;102;204;153m"; // positive highlight — green #66CC99
const D = "\x1b[2m";
const R = "\x1b[0m";
const BOLD = "\x1b[1m";

const GLITCH = "█▓▒░▄▀■□▪▫◆◇○●▌▐";
const glitchChar = (): string => GLITCH[Math.floor(Math.random() * GLITCH.length)];

const logoLines = [
  `  ${B}█████╗ ██╗██████╗ ██████╗${R}`,
  `  ${B}██╔══██╗██║██╔══██╗██╔══██╗${R}`,
  `  ${B}███████║██║██║  ██║██║  ██║${R}`,
  `  ${B}██╔══██║██║██║  ██║██║  ██║${R}`,
  `  ${B}██║  ██║██║██████╔╝██████╔╝${R}`,
  `  ${D}╚═╝  ╚═╝╚═╝╚═════╝ ╚═════╝${R}`,
];

// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — strips ANSI escape codes
const ANSI_RE = /\u001b\[[0-9;]*m/g;
const strippedLines = logoLines.map((l) => l.replace(ANSI_RE, ""));

// Both the logo frame and the info box share the same visual width (48 chars total)
// Frame: "  ┌──" + 40 spaces + "──┐" = 48
// Box:   "  ┌"   + 44 dashes  + "┐"  = 48
const INNER = 44;
const FRAME_GAP = INNER - 4; // 40

const frameTop = `  ${B}┌──${" ".repeat(FRAME_GAP)}──┐${R}`;
const frameBot = `  ${B}└──${" ".repeat(FRAME_GAP)}──┘${R}`;

function boxLine(styledText: string, textVis: number): string {
  const padding = INNER - 4 - textVis;
  return `  ${B}│${R}  ${styledText}${" ".repeat(padding)}  ${B}│${R}`;
}

function waitForKeypress(): Promise<void> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve();
      return;
    }
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}

export class BannerUseCase {
  constructor(private readonly out: NodeJS.WriteStream = process.stdout) {}

  async execute(): Promise<void> {
    if (!this.out.isTTY) return;

    const write = (s: string): void => {
      this.out.write(s);
    };
    const raw = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

    const skip = waitForKeypress();
    const sleep = (ms: number): Promise<void> => Promise.race([raw(ms), skip]);

    // --- Part 1: logo in corner frame ---
    write("\n");
    write(`${frameTop}\n`);
    write("\n");

    const rows = logoLines.length;

    const passes: [number, string][] = [
      [1.0, P],
      [0.85, P],
      [0.65, P],
      [0.45, B],
      [0.28, B],
      [0.14, B],
      [0.05, B],
      [0.01, B],
    ];

    for (const line of logoLines) write(`${line}\n`);

    for (const [intensity, col] of passes) {
      write(`\x1b[${rows}A`);
      for (let i = 0; i < rows; i++) {
        const noisy = strippedLines[i].replace(/[^\s╗╔╝╚║═]/g, (ch: string) =>
          Math.random() < intensity ? glitchChar() : ch
        );
        write(`  ${col}${noisy}${R}\n`);
      }
      await sleep(65);
    }

    write(`\x1b[${rows}A`);
    for (const line of logoLines) {
      write(`${line}\n`);
      await sleep(30);
    }

    write("\n");
    write(`    ${D}AI-Driven Dev${R}\n`);
    write(`${frameBot}\n`);

    await sleep(300);

    // --- Part 2: info box ---
    const dashes = "─".repeat(INNER);
    const empty = `  ${B}│${R}${" ".repeat(INNER)}${B}│${R}`;

    const box = [
      ``,
      `  ${B}┌${dashes}┐${R}`,
      empty,
      boxLine(`${G}${BOLD}AI-Driven Development${R}`, 21),
      boxLine(`${D}The methodology for AI coders.${R}`, 30),
      empty,
      `  ${B}└${dashes}┘${R}`,
      ``,
    ];

    for (const line of box) {
      write(`${line}\n`);
      await sleep(40);
    }

    await sleep(1500);
  }
}
