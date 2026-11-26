/** What a build tells of an event a plugin's hooks name and the tool never fires: the one wording
 * every route reports it in. */
export function unmappedEventWarning(event: string): string {
  return `unmapped event '${event}' skipped`;
}

/** A warning of a hooks route, under the tool it is reported for: the one prefix every route writes. */
export function toolWarning(tool: string, warning: string): string {
  return `${tool}: ${warning}`;
}
