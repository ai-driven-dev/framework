---
name: interview
description: Interview the PM or simulate a persona interview
argument-hint: topic/idea to explore
model: opus
---

# Interview

## Goal

Conduct interviews to extract knowledge about a project. Two modes:

- **Brain Dump**: Interview the PM to externalize their knowledge → generates `brain_dump.md`
- **Persona Simulation**: AI plays a persona role so PM can practice questions

## Context

```text
$ARGUMENTS
```

## Step 1: Choose Mode

Ask the user:

```text
What type of interview do you want?

1. 🧠 **Brain Dump** — I interview YOU to capture your project knowledge
   → Generates `brain_dump.md`

2. 🎭 **Persona Simulation** — I PLAY a persona, you practice your interview questions
   → Requires a persona file

Which one? (1 or 2)
```

**WAIT FOR USER RESPONSE**

---

## Mode 1: Brain Dump (AI interviews the PM)

### Rules

- Conversational tone, like a real oral interview — not a questionnaire
- 2-3 questions per round max, with natural follow-ups
- Capture the PM's exact words (verbatims), never rephrase
- **Use "Tell me about the last time..." to anchor in real behavior**
- **Never ask for solutions** — users describe problems well, not solutions
- **Avoid leading questions** — don't suggest the answer
- **Ask about emotions**: "How did you feel when...?"
- **Ask about workarounds**: "How do you solve this today?"
- Distinguish direct knowledge from reported stakeholder perspectives
- When PM speaks on behalf of someone: ask "Is that a direct quote or your interpretation?"
- Normalize "I don't know" — record it as a gap to investigate
- Do NOT analyze — just capture the conversation

### Step 1.1: Present Interview Outline

1. Identify the topic or idea to explore from `$ARGUMENTS`
2. Ask: "Who are the stakeholders you can speak for? (CTO, users, team leads...)"
3. Present the interview outline (6 themes: problem, users, needs, vision, differentiation, constraints)
4. **WAIT FOR USER APPROVAL** before starting

### Step 1.2: Context and Problem

Ask conversationally about:

- What is the problem or idea?
- What is the current situation?
- Who is affected?

**Key question**: "Tell me about the last time you encountered this problem..."
**Follow-up**: "What happened next? How did you feel?"

**WAIT FOR USER RESPONSE**

### Step 1.3: Users and Daily Life

Ask about:

- Who are the users concerned?
- How do they work today?
- What frustrates them?

**Key question**: "How do you solve this problem today?" (workarounds)
**Follow-up**: "What's the most frustrating part of that process?"

For each person mentioned, ask: "Is that something you observed directly?"

**WAIT FOR USER RESPONSE**

### Step 1.4: Needs and Expectations

Ask about:

- If the problem was solved, what would it look like?
- What has already been tried?
- What would make the solution adopted or abandoned?

**Key question**: "What would make this easier?"

⚠️ **Do NOT ask**: "Would you use X?" or "Do you want feature Y?"

**WAIT FOR USER RESPONSE**

### Step 1.5: Vision and Solution

Ask about:

- How would you describe your solution in 2-3 sentences?
- What's the core value proposition?

**Key question**: "If this existed tomorrow, what would users be able to do?"

**WAIT FOR USER RESPONSE**

### Step 1.6: Differentiation

Ask about:

- What makes this different from existing alternatives?
- Why would users choose this over what they do today?

**Key question**: "What have you seen that comes close but doesn't quite work?"

**WAIT FOR USER RESPONSE**

### Step 1.7: Constraints and Scope

Ask about:

- Budget, timeline, resources?
- Technical or organizational constraints?
- What is clearly out of scope?

**WAIT FOR USER RESPONSE**

### Step 1.8: Generate Brain Dump

Synthesize the conversation into the 4 Brain Dump sections:

| Section | Content from interview |
| ------- | ---------------------- |
| Quel problème ? | Step 1.2: Context and Problem |
| Pour qui ? | Step 1.3: Users and Daily Life |
| Notre solution ? | Step 1.4 + Step 1.5: Needs + Vision |
| En quoi c'est différent ? | Step 1.6: Differentiation |

Save to `{{DOCS}}/internal/product/brain_dump.md`

Display:

```text
✅ Brain Dump created!

📄 {{DOCS}}/internal/product/brain_dump.md

Next steps:
- Collect 2+ additional sources in {{DOCS}}/internal/product/sources/
- Run `/extract_brief` to generate BRIEF.md
```

---

## Mode 2: Persona Simulation (AI plays the persona)

### Step 2.1: Load Persona

Ask for the persona file:

```text
🎭 Persona Simulation Mode

Please provide the persona file path:
Example: `@{{DOCS}}/internal/product/sources/persona_emma_skeptic.md`

Or describe the persona briefly if no file exists.
```

**WAIT FOR USER RESPONSE**

If file provided:

1. Load persona details (name, role, context, frustrations, goals, quotes)
2. Confirm understanding:

```text
I'll play as [Name], a [role] who [context].
Main frustration: [frustration]
Goal: [goal]

Ready to start? Ask me anything as if I were [Name].
```

If description provided:

1. Parse: name, role, context, main frustration, goal
2. Confirm before starting

### Step 2.2: Enter Role-Play Mode

Display:

```text
🎭 SIMULATION MODE ACTIVE

I am now [Persona Name]. Ask me questions as you would in a real user interview.

Tips for good questions:
- "Tell me about the last time..."
- "How do you handle X today?"
- "How did that make you feel?"

Type /end to finish the simulation.
```

### Step 2.3: Respond as Persona

For each user question:

1. **Stay 100% in character** — never break the fourth wall
2. **Show emotions** — frustration, enthusiasm, hesitation
3. **Be specific** — mention real tools, times, situations
4. **Don't over-share** — make the PM dig for insights
5. **React to question quality**:

| Question type | Persona response |
| ------------- | ---------------- |
| "Would you use X?" | "Maybe... I guess?" (unhelpful) |
| "Tell me about the last time..." | Rich story with emotions |
| "What solution do you want?" | "I don't know, I just want it to work." |
| "How do you feel when..." | Deep emotional insight |
| "How do you do this today?" | Describes workarounds |

### Step 2.4: End and Debrief

When user types `/end` or after 7+ exchanges:

```text
🎭 END SIMULATION

## Debrief

### Insights revealed (as [Persona]):
- Pain point: [specific frustration mentioned]
- Workaround: [how they solve it today]
- Emotional trigger: [what frustrated/excited them]

### Your interview technique:
- ✅ Good questions: [list effective questions]
- ⚠️ Leading questions: [list if any]
- 💡 Missed opportunities: [topics not explored]

### Suggested follow-ups for real interviews:
- [Question 1]
- [Question 2]

---

Next steps:
- Practice with another persona variation (optimist/skeptic/power user)
- Prepare your script for real user interviews
```

---

## Anti-patterns to Avoid

| ❌ Don't | ✅ Do instead | Why |
| --- | --- | --- |
| "Would you use this feature?" | "Tell me about the last time you needed..." | Hypotheticals ≠ real behavior |
| "Don't you think X is a problem?" | "What challenges do you face with...?" | Leading question |
| "What solution would you want?" | "What would make this easier?" | Users describe problems, not solutions |
| "Do you like the current process?" | "Walk me through your typical workflow" | Yes/No = no insight |
