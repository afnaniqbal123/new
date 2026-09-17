# ADR policy

The canonical policy — including the template, required fields, and the index —
is [`docs/adr/README.md`](../../../../docs/adr/README.md). It is written for
humans as well as agents, so it lives with the records rather than in a skill.

This page covers only what an agent needs on top of it.

## Deciding, mechanically

All three, or no ADR:

1. Hard to reverse
2. Surprising without context
3. A genuine trade-off with real alternatives

## Do not write an ADR for

- Something already decided. Check `docs/adr/` first — if a decision exists and
  still holds, link it. A second ADR saying the same thing splits the record.
- A decision nobody made. If there was one obvious path and it was taken, there
  is nothing to record.
- Documentation of _what_ the code does. That is an architecture doc.

## Writing one

Required: `**Status:**` and `**Date:**`, checked by `npm run docs:check`.
Filename `NNNN-kebab-slug.md`; take the highest number in `docs/adr/` and add
one. Add a row to the table in `docs/adr/README.md` — the index is not
generated.

Two things that make an ADR worth having later:

**State the cost.** An ADR listing only benefits is an advertisement. The
reader in a year needs to know what was accepted, so they can tell whether the
trade still holds.

**Record the rejected option and why.** Without it, someone re-proposes it in
six months and the argument runs again from the start.

## Changing your mind

Never edit a decision that turned out wrong — that erases the reasoning. Write
a new ADR, mark the old `Superseded by ADR-NNNN`, link both ways.

## Related skills

`domain-modeling` and `grill-with-docs` also produce ADRs. They defer to the
same policy — see the note in
[`domain-modeling/ADR-FORMAT.md`](../../domain-modeling/ADR-FORMAT.md). If the
policy needs to change, change `docs/adr/README.md`; do not let the two drift.
