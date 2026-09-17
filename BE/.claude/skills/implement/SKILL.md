---
name: implement
description: 'Implement a piece of work based on a spec or set of tickets.'
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

If the work altered module ownership or boundaries, the authentication or
authorization model, persistence strategy, an external integration, or a
cross-cutting convention, invoke /architecture-documentation and update the
docs in this same change. Documentation that lands in a follow-up PR does not
land.

Once done, use /code-review to review the work.

Commit your work to the current branch.
