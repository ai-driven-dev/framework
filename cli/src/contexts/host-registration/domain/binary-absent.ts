/** Says what a host's missing CLI leaves standing, in the words every refusal of it shares. */
export function binaryAbsentNotice(binary: string, left: string): string {
  return `${binary}: ${left} left in place, the ${binary} CLI is not on the PATH.`;
}
