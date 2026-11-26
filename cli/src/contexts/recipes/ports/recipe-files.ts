export type RecipeSource =
  | { readonly kind: "readable"; readonly content: string }
  | { readonly kind: "unreadable"; readonly code: string };

export interface RecipeDirectory {
  readonly path: string;
  readonly optional: boolean;
}

export interface RecipeFiles {
  read(file: string, contentRequired?: boolean): RecipeSource;
  list(directory: RecipeDirectory): string[];
}
