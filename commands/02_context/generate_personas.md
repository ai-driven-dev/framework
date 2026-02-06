---
name: generate_personas
description: Create detailed user personas with 3 variations (Optimist, Skeptic, Power User)
argument-hint: [product/audience] OR (uses previous empathy maps)
---

# Generate Personas

## Goal

Create **3 persona variations** per user profile: Optimist, Skeptic, Power User.

> "A killer user persona is not just a document, it's your secret weapon for building products that resonate on a human level." — AI PM Course

## Rules

- Template: `@{{DOCS}}/templates/pm/persona.md`
- Variations: Optimist / Skeptic / Power User
- Each persona must have quotes (real or hypothetical)
- VIBE check before output
- Mark as "simulated" if no real sources

## Context

```text
$ARGUMENTS
```

## Modes

### Mode 1: From Empathy Maps

Use when you have already run `/extract_insights` or have empathy maps.

```text
/generate_personas
```

### Mode 2: Standalone (for simulation)

Use to quickly create personas BEFORE having real data.

```text
/generate_personas

App de meal planning pour millennials éco-responsables, urbains,
qui manquent de temps pour cuisiner healthy.
```

---

## Steps

### Step 1: Gather Initial Intel

If standalone mode, ask for context:

```text
Before creating personas, I need some initial intel:

1. What's your product in one sentence?
2. Who is it for? (rough profile)
3. What problem does it solve?
4. Any existing data? (reviews, feedback, competitor insights)
```

Wait for user response before proceeding.

If empathy maps exist, load them from `{{DOCS}}/internal/product/`.

### Step 2: Generate Base Persona

Use this prompt structure:

```text
Create a detailed user persona for [product/audience].

Include:
- **Demographics**: age, job title, location, income range
- **Psychographics**: values, motivations, lifestyle
- **Behaviors**: daily routines, tech usage, favorite apps
- **Pain points**: specific frustrations with quotes
- **Goals**: what success looks like for them
- **Day-in-the-life scenario**: timeline from morning to evening

Based on: [user's context or empathy maps]
Make it realistic and data-backed where possible.
```

### Step 3: Generate 3 Variations

For each base persona, generate all 3 variations:

| Variation | Description | Key Question | What It Reveals |
| --------- | ----------- | ------------ | --------------- |
| **Optimist** | Enthusiastic early adopter, sees the potential | "What would make them recommend us?" | Wow features, positive messaging |
| **Skeptic** | Reluctant user, critical, compares to alternatives | "What objections will they raise?" | Adoption barriers, trust issues |
| **Power User** | Advanced user, demanding, pushes the limits | "What features will they demand?" | Advanced needs, edge cases |

Prompt for variations:

```text
From this base persona [Name], generate 3 variations:

1. OPTIMIST version: enthusiastic early adopter who sees the potential
2. SKEPTIC version: reluctant user who compares to alternatives
3. POWER USER version: advanced user who pushes the limits

For each variation, adjust:
- Motivations and drivers
- Frustrations and objections
- Expectations and must-haves
- Key quote that captures their mindset
```

### Step 4: Add Hypothetical Quotes

For each persona variation, add realistic interview quotes:

```text
Add 2-3 realistic interview quotes for this persona.
Quotes should:
- Reflect their specific frustrations
- Express their expectations
- Sound like real speech (hesitations, emotions)
- Be tied to pain points or goals

Example format:
> "I've tried like three apps already and they all... I don't know,
> they just don't get how chaotic my mornings actually are."
```

### Step 5: Add Economic & Technical Profile

Complete each persona with:

| Section | Details to include |
| ------- | ------------------ |
| **Economic profile** | Income range, budget for this category, price sensitivity, purchase frequency |
| **Technical environment** | Primary device, OS, tech proficiency (novice/intermediate/advanced), favorite apps |
| **Digital habits** | Tools used daily, social platforms, content consumption |

### Step 6: VIBE Check

Before saving, verify:

- [ ] **V**erify: Cited sources exist and are verifiable (or marked as simulated)
- [ ] **I**nterpret: Profile is consistent with product context
- [ ] **B**ias: Potential biases are identified
- [ ] **E**vidence: Key insights have 2+ sources (or marked as hypothetical)

### Step 7: Save and Output

Save to `{{DOCS}}/internal/product/sources/`:

- `persona_<name>_optimist.md`
- `persona_<name>_skeptic.md`
- `persona_<name>_power_user.md`

Display:

```text
✅ Personas generated!

📄 persona_<name>_optimist.md
📄 persona_<name>_skeptic.md
📄 persona_<name>_power_user.md

⚠️ These are SIMULATED personas. Validate with real users before prototyping.

Next steps:
- Run `/interview` (mode 2) to practice interview questions
- Validate with 3-5 real users via Typeform or Maze
- Run `/extract_insights` when you have real data
```

---

## Refinement Prompts

Use these to iterate on generated personas:

### Make Pain Points More Specific

```text
Update this persona by making the pain points more specific.
Add concrete examples and emotional reactions.
```

### Add Quotes from Hypothetical Interviews

```text
Add 3 more interview quotes for this persona.
Include moments of frustration, hope, and skepticism.
```

### Update with New Feedback

```text
Update this persona with [new feedback/trend].
Adjust pain points, goals, and day-in-the-life scenario accordingly.
```

### Incorporate Trends

```text
Update this persona to incorporate 2025 trends like [specific trends].
Adjust behaviors and expectations accordingly.
```

---

## Using Your Personas

Once created, use personas as your North Star:

| Use Case | How |
| -------- | --- |
| **Roadmapping** | "Would [Persona] love this feature?" |
| **User Stories** | "As [Persona], I want X so that Y" |
| **Feature Ideas** | Feed persona to AI: "Generate 5 feature ideas for [Persona]" |
| **Interview Simulation** | Run `/interview` mode 2 with the persona file |
| **Team Alignment** | Share in meetings for quick buy-in |
| **Metrics Tracking** | Compare post-launch metrics to persona predictions |

---

## Anti-patterns

| ❌ Don't | ✅ Do instead | Why |
| -------- | ------------- | --- |
| "Marie, 35, manager" | Specific context + verbatims | Too generic, not actionable |
| Persona without frustrations | Document pain points with quotes | Missing the "why" |
| Persona without quotes | Add 2-3 realistic interview quotes | Lacks human voice |
| Single persona | Always 3 variations minimum | Tunnel vision |
| Skip validation | Share with 3-5 real users | Risk of building for imaginary user |
| Skip VIBE check | Verify sources and biases | Risk of hallucination |

---

## Example: Eco Emma

**Base profile**: 32-year-old marketing executive in Seattle, values zero-waste living, struggles with time for healthy cooking.

| Variation | Key Quote |
| --------- | --------- |
| **Optimist** | "I'm so excited to finally have something that gets me! This could totally change my meal prep game." |
| **Skeptic** | "I've tried like three apps already... they all promise the same thing. What makes this different?" |
| **Power User** | "I need to see my macros, carbon footprint per meal, AND sync with my grocery delivery. Is that too much to ask?" |
