# Harbor contributor guidance

Use integer cents for every monetary amount. Preserve public API response contracts and keep HTTP concerns outside the domain.

<!-- aidd_project_memory:start -->

[aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md)

<!-- aidd_project_memory:end -->
<!-- aidd_rules:start sha256=c61c8f70d8006124a054def769b8d4ab4fafaf55ad627ec2bad35ad52526ae48 separator=0 -->
## 01-standards/1-domain-review: Domain review marker

Apply this rule when working on files matching: "src/domain/**/*.ts".

# Domain review marker

- Place the exact comment `// Team reviewed domain change` immediately above every newly declared exported function.
- Do not change existing functions.
<!-- aidd_rules:end -->
