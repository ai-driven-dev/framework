/**
 * Whether an already-resolved candidate path sits strictly inside an already-resolved boundary
 * directory, never equal to it. Both arguments must come from a real filesystem resolution.
 */
export type IsWithinUserScope = (resolvedCandidate: string, resolvedBoundary: string) => boolean;
