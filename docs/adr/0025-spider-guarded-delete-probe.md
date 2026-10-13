# 0025: The Spider opens Interactive States and probes Delete under a guard

Status: Accepted, 2026-10-12.

Builds on [0003](0003-deterministic-safety-filters.md) (Safety Filter) and [0024](0024-intent-and-refusal-rule.md) (Interactive States, Spider contract).

## Context
Forms hidden in tabs, accordions, drawers and dialogs were never reached, and list pages gave the Plan no facts about Add, Edit and Delete. Finding them means clicking controls on a site we may not own. Delete is the one control the Safety Filter and the risky-name list refuse to touch.

## Decision
- After a page is recorded, and only when click exploration is on and the click budget allows, the Spider clicks openers one at a time (`[role=tab]`, `summary`, controls that toggle or carry `aria-expanded`, `aria-haspopup`, `aria-controls`, and plain buttons named New/Add/Create/Open/Compose/Write/Show/More). An opener must pass the Safety Filter and the risky-name list and must not sit inside a form. The page is reloaded between openers. A form that was not visible before and is visible after gets the opener as its `opening` step.
- CRUD facts (`list`, `add`, `editFromRow`) are read from structure only.
- The Delete probe is the single exception to "never click Delete". It is allowed only when all of these hold: the page is on the site being scanned; the control sits in a table or list row, outside a form; its name is a plain per-row delete ("Delete", "Remove", "Delete row"), not "Delete account" or "Delete all"; the Safety Filter classifies it as an ordinary deletion (a forbidden-action keyword from the person turns the probe off).
- Guard while exploring and probing (`guardPage`): every POST, PUT, PATCH and DELETE request is aborted in the browser before it is sent, and every browser dialog is dismissed. So nothing is deleted even if the app deletes without asking.
- The probe clicks Delete, waits, and records `deleteConfirm: true` if a browser confirm, `[role=alertdialog]` or open `dialog` appeared (it clicks Cancel on a page dialog), `false` if none did. `false` is a fact reported to the person, not a failure.

## Consequences
- An app that deletes through a GET link or a form POST navigation is not protected by request aborts for GET; such controls inside a form are never clicked, and a GET delete link is a known gap. The row-delete name rule and the same-site rule limit it.
- Each opener and the probe cost one click from the existing budget.
