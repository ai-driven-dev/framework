export const SETTINGS: { directory: string } = JSON.parse('{"directory":".cursor/"}');

export function readDirectory(): string {
  return SETTINGS.directory;
}

export function readSiblingDirectory(): string {
  return SETTINGS.directory;
}

export function readLiteralDirectory(): string {
  return SETTINGS.directory;
}
