# Domain docs

## Layout

This repo uses a single-context layout:

- `GLOSSARY.md` at the repo root contains domain terms.
- `docs/adr/` contains architecture decision records.

## Before exploring

Read the root glossary and ADRs relevant to the area being explored.
If either is absent, proceed silently. Domain modeling creates these
documents lazily when terms or decisions are resolved.

## Vocabulary

Use glossary terms in issue titles, proposals, hypotheses, and test names.
If a needed concept is missing, reconsider the term or note the gap for
domain modeling.

## ADR conflicts

Explicitly surface proposals that contradict an existing ADR.
Name the ADR and explain why the decision should be reopened.
