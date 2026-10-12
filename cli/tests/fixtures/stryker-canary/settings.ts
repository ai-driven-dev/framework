export const SETTINGS: { directory: string } = JSON.parse('{"directory":".cursor/"}');

export function readDirectory(): string {
  return SETTINGS.directory;
}
