# 03 - Image extract details

Analyze an image to identify and extract the main components, group them by type, merge close variants, and emit a hierarchical inventory ready for planning.

## Inputs

```yaml
image: <path or attachment, passed via $ARGUMENTS>
```

## Outputs

```yaml
main_reusable_components_with_variants:
  - name: <component name>
    variants:
      - name: <variant name>
        style: <one-line description>
main_display_components:
  - component_name: <section name>
    layouts:
      - type: <layout type>
        style: <one-line description>
        position_and_display: <text>
        components: [<nested entries>]
```

## Process

1. **Identify reusable components.** Scan the image for repeatable UI atoms; group them by type.
2. **Extract variants.** For each reusable atom, collect distinct visual variants. Merge variants that are very close (same role, marginal styling differences).
3. **Remove duplicates.** Keep each unique component once.
4. **Hierarchical organization.** Place layout-level display components above the reusable atoms; nest layouts and their sub-components.
5. **Boundaries.** Emoji are not components. Do not detail photography.

## Test

`main_reusable_components_with_variants` lists each unique reusable atom exactly once with at least one variant; `main_display_components` covers every top-level section visible in the image; no entry references emoji or stock photography.

## Output format example

```yaml
main_reusable_components_with_variants:
  - name: "Chip"
    variants:
      - name: "Generate"
        style: "Purple text, rounded pill shape, small sparkle icon"

main_display_components:
  - component_name: Hero Section
    layouts:
      - type: Vertical Stack
        style: "Centered alignment, full-width layout"
        position_and_display: "Top of page"
        components:
          - type: Text Block
            content: "For individuals, independent creators and tech companies"
            variant: "Heading"
          - type: Text Block
            content: "Empowering individuals, creators, and tech innovators with cutting-edge AI solutions."
            variant: "Subheading"

  - component_name: Feature Grid
    layouts:
      - type: Two-Column Layout
        style: "Even 2-column grid, responsive layout"
        position_and_display: "Below hero section"
        components:
          - component_name: Right Feature Card
            position_and_display: "Right column"
            layout: "Vertical stack"
            sub_components:
              - type: Text Block
                content: "Don't write by yourself, it's boring. Instead, let AI"
                variant: "Paragraph"
              - type: Chip
                content: "Enhance"
                variant: "Enhance"
```
