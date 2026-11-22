import path from "node:path";

/** The file a link points at, the linking file itself when it names none, undefined when its path is not valid URI encoding. */
export function localTargetFile(file: string, rawPath: string): string | undefined {
  if (!rawPath) return file;
  try {
    return path.resolve(path.dirname(file), decodeURI(rawPath));
  } catch {
    return undefined;
  }
}
