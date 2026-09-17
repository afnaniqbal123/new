# Quality rules

## What the checker enforces

```bash
npm run docs:check
```

| Check                        | Catches                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| Relative links resolve       | A doc moved and the links to it did not                              |
| Mermaid sanity (not a parse) | Empty blocks, unknown diagram types, unbalanced brackets             |
| ADR naming and fields        | Missing `Status`/`Date`, wrong filename, missing number in the title |
| Architecture index           | A document nobody linked, so nobody will find                        |

Stage 6 of `npm run verify`, and a CI step.

## What it cannot do

It checks facts, not truth. A document can pass every check and still describe
a system that does not exist. The checker will never tell you:

- whether a claim matches the code
- whether a diagram shows the real mechanism
- whether the ADR records the actual reason
- whether a document is worth reading

That is what review is for. **Passing `docs:check` is not evidence the
documentation is correct.**

## Writing rules

**Every claim traces to something.** Prefer citing the file, or the test that
proves it, over asserting it.

**Specific beats general.** "Access tokens expire in 15 minutes" is checkable
and useful. "Tokens are short-lived" is neither.

**State the cost.** A page describing only benefits reads as marketing and gets
skipped. The reader needs the trade-off to judge whether it still holds.

**Say the awkward thing.** Known debt, a deliberate exception, a hole not yet
closed — write it down. A documented gap is a decision. A silent one is a trap
for whoever finds it at 2am.

**Do not restate the code.** If the doc is a prose transcription of a function,
delete it; the function is clearer and cannot go stale.

## Reviewing documentation

Ask:

1. Is anything here no longer true?
2. Does any diagram show only the happy path?
3. Does a claim need evidence it does not have?
4. Is a decision described without its cost?
5. Would a new joiner get a wrong idea from this?

## Common failures

| Failure                            | Fix                                               |
| ---------------------------------- | ------------------------------------------------- |
| Documented aspiration as fact      | Say what is; put the rest in an issue             |
| Regenerated a doc to change a line | Edit the line; the rest carries reasoning         |
| Diagram omits the failure path     | Show the refusal — that is where the design lives |
| ADR with no rejected alternative   | Record what lost and why, or it gets re-proposed  |
| Doc duplicating a module README    | Link instead; one of them will go stale           |
