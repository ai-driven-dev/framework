function buildCommandName(fm: Record<string, unknown>, relativeFileName: string): string {
  const phase = relativeFileName.match(/^(\d+)/)?.[1];
  const baseName = String(fm.name ?? "");
  return phase ? `aidd:${phase}:${baseName}` : baseName;
}

export function convertCommandFrontmatter(
  fm: Record<string, unknown>,
  relativeFileName: string
): Record<string, unknown> {
  const name = buildCommandName(fm, relativeFileName);
  const result: Record<string, unknown> = { name, description: fm.description };
  if (fm["argument-hint"] !== undefined) result["argument-hint"] = fm["argument-hint"];
  return result;
}

export function convertCommandFrontmatterNoHint(
  fm: Record<string, unknown>,
  relativeFileName: string
): Record<string, unknown> {
  const name = buildCommandName(fm, relativeFileName);
  return { name, description: fm.description };
}

export function buildAiddCommandFilePath(dir: string, fileName: string): string {
  const slashIdx = fileName.indexOf("/");
  if (slashIdx !== -1) {
    const phase = fileName.match(/^(\d+)/)?.[1];
    if (phase) {
      return `${dir}commands/aidd/${phase}/${fileName.slice(slashIdx + 1)}`;
    }
  }
  const baseName = fileName.slice(fileName.lastIndexOf("/") + 1);
  return `${dir}commands/aidd/${baseName}`;
}

/** The directory of one phase's commands. */
export function phasedCommandsDir(dir: string, phase: string): string {
  return `${dir}commands/aidd/${phase}/`;
}

/** Where a command lands under the phase its directory is numbered with; none when unnumbered. */
export function phasedCommandPath(dir: string, fileName: string): string | undefined {
  const phased = fileName.match(/^(\d+)[^/]*\/(.*)/);
  return phased ? `${phasedCommandsDir(dir, phased[1])}${phased[2]}` : undefined;
}
