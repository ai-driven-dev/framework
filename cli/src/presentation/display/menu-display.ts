import type { Output } from "../deps.js";

const BANNER = `
   _    ___ ___  ___
  /_\\  |_ _|   \\|   \\
 / _ \\  | || |) | |) |
/_/ \\_\\|___|___/|___/

 AI-Driven Development CLI`;

export function printBanner(output: Output): void {
  output.print(BANNER);
}
