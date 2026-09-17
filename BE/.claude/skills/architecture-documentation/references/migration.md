# Migrating existing documentation

For documentation predating this standard.

## Do not regenerate

The strong temptation is to rewrite everything to the template. Resist it.
Existing docs carry reasoning that took real argument to reach, and a
regeneration silently replaces it with fluent text that reads better and knows
less.

Audit and edit. Never bulk-rewrite.

## The audit

For each existing document:

1. **Is it still true?** Check against the code. Wrong beats missing, because
   wrong is trusted.
2. **Is it in the right place?** See [`structure.md`](structure.md).
3. **Is it architecture, or module detail?** Module detail belongs in that
   module's README.
4. **Does it contain a decision that should be an ADR?** Extract it and link.
5. **Do its diagrams render?** `npm run docs:check`.

## Moving a document

```bash
git mv docs/architecture/old-name.md docs/architecture/new/place.md
```

Then, in order:

1. Fix inbound links — `grep -rn "old-name.md" .` and update every hit,
   including source comments, lint-rule messages, CI configuration, and module
   READMEs.
2. Fix the moved file's own relative links; the depth changed and every `../`
   inside it is now wrong.
3. Add it to `docs/architecture/README.md`.
4. `npm run docs:check`.

Step 2 is the one that gets missed. The checker exists largely to catch it.

## Contradictions

Where two documents disagree, the code decides. Fix the wrong one and say so in
the commit — a contradiction usually means something changed and only one
document was updated, which is worth knowing.

## Leaving debt

Do not fabricate a document to fill a slot in the hierarchy. Missing is honest;
a stub is not. Note the gap in `docs/architecture/README.md` or open an issue.
