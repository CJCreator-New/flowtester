# Wizard design rationale

The wizard is for people who don't test software for a living: product managers, founders,
marketers. `packages/web` (QA Flow Studio) is a dark, dense dashboard for engineers; this is its
opposite on purpose, so nobody mistakes one for the other.

## Concept: a check-up slip

The journey is a real sequence, so it's shown as one: a slip on the left lists the steps and fills
in with each answer ("Website address: shop.example.com", "Signing in: Not needed"), like a form
being completed at a counter. On phones it collapses to "Step 2 of 5". The report ends with the
one bold element: an inspector's rubber stamp, *Ready to release* or *Not ready yet*.

## Colour

| Token | Hex | Use |
|---|---|---|
| paper | `#F3F6FB` | Page background. Cool and light, like a fresh form; avoids the cream/terracotta default |
| surface | `#FFFFFF` | Fields and choice panels |
| ink | `#1B2440` | Text (14.1:1 on paper) |
| ink-soft | `#4B5675` | Secondary text (6.7:1 on paper) |
| stamp | `#5132C4` | Stamp-pad violet: actions, focus ring, progress. White text on it is 8.1:1 |
| pass / fail / warn | `#1D6B45` / `#B42318` / `#8A5300` | Verdict and status, each ≥ 5.6:1 on its tint |
| edge | `#6E7A96` | Field borders, ≥ 3:1 against paper and surface (WCAG 1.4.11) |

Every text pairing is checked by `tests/contrast.test.ts`, which fails the build if a palette change
drops below WCAG 2.1 AA.

## Type

- **Atkinson Hyperlegible Next** for everything. It was designed by the Braille Institute for
  readers with low vision, which fits a tool that audits accessibility and an audience that reads
  every word. Base size is 18px; questions are set large (up to 44px) because each screen asks
  exactly one.
- **Big Shoulders Stencil Display** appears once, on the stamp. Stencil lettering is what
  inspection stamps and crates use; confining it to one element keeps it special.

## Motion

One moment only: the stamp lands when the report appears. Everything else is still, and the stamp
and progress animations switch off under `prefers-reduced-motion`.

## Writing

Plain verbs, sentence case, and no testing vocabulary: "Clicking “Save invoice”…", not selectors
or event names. Errors say what happened and what to do next. The event-to-sentence rules live in
`src/lib/translate.ts`; finding titles are rewritten in `src/lib/summary.ts`.
