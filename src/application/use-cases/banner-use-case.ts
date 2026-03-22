const B = "\x1b[38;2;78;78;249m";
const P = "\x1b[38;2;221;84;117m";
const G = "\x1b[38;2;102;204;153m";
const D = "\x1b[2m";
const R = "\x1b[0m";
const BOLD = "\x1b[1m";

const GLITCH = "█▓▒░▄▀■□▪▫◆◇○●▌▐";
const glitchChar = (): string => GLITCH[Math.floor(Math.random() * GLITCH.length)];

const logoLines = [
  `  ${B}█████╗ ${P}██╗${B}██████╗ ${P}██████╗${R}`,
  `  ${B}██╔══██╗${P}██║${B}██╔══██╗${P}██╔══██╗${R}`,
  `  ${B}███████║${P}██║${B}██║  ██║${P}██║  ██║${R}`,
  `  ${B}██╔══██║${P}██║${B}██║  ██║${P}██║  ██║${R}`,
  `  ${B}██║  ██║${P}██║${B}██████╔╝${P}██████╔╝${R}`,
  `  ${D}╚═╝  ╚═╝╚═╝╚═════╝ ╚═════╝${R}`,
];

// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — strips ANSI escape codes
const ANSI_RE = /\u001b\[[0-9;]*m/g;
const strippedLines = logoLines.map((l) => l.replace(ANSI_RE, ""));

const INNER = 44;

function boxLine(styledText: string, textVis: number): string {
  const padding = INNER - 4 - textVis;
  return `  ${D}│${R}  ${styledText}${" ".repeat(padding)}  ${D}│${R}`;
}

export class BannerUseCase {
  constructor(private readonly out: NodeJS.WriteStream = process.stdout) {}

  async execute(): Promise<void> {
    if (!this.out.isTTY) return;

    const write = (s: string): void => {
      this.out.write(s);
    };
    const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

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

    await sleep(200);

    const dashes = "─".repeat(INNER);
    const empty = `  ${D}│${R}${" ".repeat(INNER)}${D}│${R}`;

    const box = [
      `\n  ${BOLD}AI-Driven Dev${R}\n`,
      ``,
      `  ${D}┌${dashes}┐${R}`,
      empty,
      boxLine(`${G}${BOLD}AI-Driven Development${R}`, 21),
      boxLine(`${D}The methodology for AI coders.${R}`, 30),
      empty,
      `  ${D}└${dashes}┘${R}`,
      ``,
    ];

    for (const line of box) {
      write(`${line}\n`);
      await sleep(40);
    }
  }
}
