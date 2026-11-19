/** The one place a command ends the process. */
export function exitWith(code: number): never {
  process.exit(code);
}
