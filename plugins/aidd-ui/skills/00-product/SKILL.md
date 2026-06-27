---
name: 00-product
description: Define the product and what "good" means for it, by deep interview, into PRODUCT.md. Use to open the UI recipe, before any wireframe or design. Do NOT use to write a PRD or functional spec (that is the product-management concern), and not to write code.
argument-hint: init | interview | define-good
requires: "—"
next: 01-wireframe
produces: PRODUCT.md
---

# Skill: product

The first section of the UI recipe. Run a deep interview to fix what the product is and what makes it *good*, captured in `PRODUCT.md` at the repo root.

## Recipe

Run the steps in order, `01 → 03`. Each step completes before the next. **Exit gate:** the `product-critic` agent validates `PRODUCT.md` against its own bar; it does not advance to `01-wireframe` until the critic passes it.

## Actions

| #   | Action        | Role                                                          | Input                |
| --- | ------------- | ------------------------------------------------------------ | -------------------- |
| 01  | `init`        | Copy the `PRODUCT.md` template to the root if absent, else load it | repo root            |
| 02  | `interview`   | Deep, iterative Q&A on vision, audience, jobs, expectations  | `PRODUCT.md` skeleton |
| 03  | `define-good` | Articulate the "good product" criteria and design principles | interview answers     |

## Assets

- `assets/PRODUCT.md`: the `PRODUCT.md` scaffold, copied to the repo root and filled in.
