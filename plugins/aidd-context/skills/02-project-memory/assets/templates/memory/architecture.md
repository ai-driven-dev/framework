# Architecture

## Stack

- {{Which language, runtime and main framework, and why this one? One line each.}}
- Libraries: {{Which libraries own state, data fetching, validation and UI primitives when no capability file owns them, and which must new code not add?}}

## Config

- {{Where are environment variables declared and secrets sourced, and how is a new one added? Never a value.}}

## Decisions

- {{Which decision is not obvious from the code, and what is its reason?}}

## Constraints

- {{Which constraint or trade-off must a contributor respect?}}

## Placement

- {{Where does new code of each kind go when the folder names do not say?}}

## Dependencies

- {{Which layers or modules may import which? One line per allowed direction, or the file that enforces it.}}

## Gotchas

- {{What surprises a newcomer here, and what avoids it?}}

## Flow

- {{Which processes, hosts or repositories hand work to each other? One line `A -> B -> C`, drawn as one mermaid flowchart.}}
