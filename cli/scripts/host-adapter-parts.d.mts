import type { Options } from "tsup";

export function partFile(name: string): string;
export function isTemplate(name: string): boolean;
export function adapterFile(name: string): string;
export function templateOf(file: string): string | undefined;
export function partNamesIn(runtime: string): string[];
export function splitTemplate(text: string): string[];
export function partText(content: string): string;
export const joinedHostAdapters: NonNullable<Options["esbuildPlugins"]>[number];
