# Worked examples

The judgement this skill exists to make consistent is a single question: **is
this change architectural, and if so does it need an ADR?** Get it wrong in one
direction and docs rot; wrong in the other and every typo drags a decision
record behind it.

These are real changes from this repository.

## No documentation needed

| Change                              | Why not                                                           |
| ----------------------------------- | ----------------------------------------------------------------- |
| Fix an off-by-one in pagination     | Behaviour of one function. The test is the record.                |
| Add a `@MinLength(8)` to a DTO      | Validation detail, visible in the DTO.                            |
| Rename a private helper             | Nothing outside the file can tell.                                |
| Add a field to an existing response | No boundary moved. Update the module README if it is user-facing. |
| Add a test                          | Tests document themselves.                                        |

The correct answer here is usually "no". Reaching for the skill on every change
makes it noise, and noise gets ignored.

## Architecture doc, no ADR

| Change                                            | Where                                      | Why no ADR                                           |
| ------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| Split `ChatService` into three services           | `module-architecture.md` — ownership table | Applies a rule already decided; no new trade-off     |
| Six modules stop registering the `User` model     | `module-architecture.md`                   | A consequence of an existing decision, not a new one |
| Add a new provider webhook endpoint               | `system-context.md` — externals            | New integration point, but the pattern is settled    |
| Document that the SSE stream trusts a route param | debt list                                  | Recording reality, not deciding anything             |

The pattern: **applying** an existing decision is a doc change; **making** one
is an ADR.

## ADR required

| Change                                              | Hard to reverse?                          | Surprising?                        | Real alternatives?                      |
| --------------------------------------------------- | ----------------------------------------- | ---------------------------------- | --------------------------------------- |
| Authentication becomes stateless, role in the token | Yes — clients and revocation depend on it | Yes — a reader expects a DB lookup | Yes — session lookup, revocation cache  |
| Adopt CASL as the canonical authorization engine    | Yes — policies get written against it     | Yes — role guards look simpler     | Yes — hand-rolled policies, Casbin, OPA |
| Password reset stops being a JWT                    | Yes — the token format is a contract      | Yes — everything else is a JWT     | Yes — JWT with a denylist               |
| Markdown + Mermaid as the only doc format           | Moderate                                  | Yes — the upstream offers six      | Yes — C4 tooling, Arc42, PlantUML       |

All three columns must be "yes".

## The close calls

**"We added a Redis cache for org membership."** ADR. It introduces
infrastructure and trades staleness for latency — someone will ask why in a
year.

**"We bumped the access-token TTL from 15m to 30m."** No ADR, but the existing
one must be updated: ADR 0001 argues the design _from_ that number. A decision
record whose premise silently changed is worse than none.

**"We added a fourth chat service."** No ADR. Doc update only, if the ownership
table names the services.

**"We moved `@GetUser` into the auth module."** Doc update. It resolved a
dependency cycle, which sounds architectural, but it applied rule 7 in
`module-architecture.md` rather than deciding anything new.

## When genuinely unsure

Ask whether a competent engineer, reading the code in a year, would say **"why
on earth is it like this?"**

If yes, the reason is not in the code and needs recording. If they would say
"fine, obviously" — there is nothing to record.
