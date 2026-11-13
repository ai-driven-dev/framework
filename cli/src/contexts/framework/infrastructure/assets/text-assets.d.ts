declare module "*.md" {
  const content: string;
  export default content;
}

declare module "*.toml" {
  const content: string;
  export default content;
}

declare module "*.txt" {
  const content: string;
  export default content;
}

// biome-ignore lint/correctness/noUnresolvedImports: a hook adapter, inlined as source text
declare module "*.cjs" {
  const content: string;
  export default content;
}
