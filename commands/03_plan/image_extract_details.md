---
name: image_extract_details
description: Analyze image to identify and extract main components with hierarchical organization
argument-hint: the image to analyze
---

# Goal

Analyze the provided image to identify and extract the main components.
Ensure to distinguish primary component groups and all sub-components on the page.
Some components might be duplicated -> only extract unique components.

## Steps

1. Identify all reusable component, group them by type.
2. Extract variants, merge closer variants.
3. Remove duplicates.
4. Hierarchical Organization.

## Rules

- Emoji are not components.
- No need to detail photography.

## Output Format Example

```yml
main_reusable_components_with_variants:
  - name: "Chip"
    variants:
      - name: "Generate"
        style: "Purple text, rounded pill shape, small sparkle icon"
      ...

  ...

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
                content: "Don’t write by yourself, it’s boring. Instead, let AI"
                variant: "Paragraph"

              - type: Chip
                content: "Enhance"
                variant: "Enhance"

              - type: Text Block
                content: "Your prompts"
                variant: "Paragraph"

              - type: BrowserWindowMockup
                variant: "Prompt Display Mockup"
                sub_components:
                  - component_name: PromptCard
                    layout: "Stacked content with prompt + tags"

                    ...
```
