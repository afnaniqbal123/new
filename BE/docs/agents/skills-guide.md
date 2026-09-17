# Claude Code Skills — Team Guide

This repo ships a set of Claude Code "skills" under [`.claude/skills/`](../../.claude/skills/). A skill is just a
folder of instructions that Claude Code loads automatically when it's relevant, or that you can call directly by
typing `/<skill-name>` in the chat. Because they live inside `.claude/skills/` and are committed to git, **everyone
who clones this repo gets the same skills — no plugin install needed.**

You don't need to memorize anything below. Just type `/` in Claude Code to see the list, or say what you want in
plain English ("debug this failing test", "review my branch") and the right skill kicks in on its own.

---

## Skills written for this repo

These three were built specifically for our NestJS + Mongoose backend.

### `best-practices`

**What it is:** Our coding conventions — how we structure Nest modules, controllers, services, DTOs, guards, and
Mongoose schemas.
**When it kicks in:** Automatically, any time Claude writes, reviews, or refactors backend code. You don't need to
call it directly.

### `fix-commit`

**What it does:** Fixes whatever is blocking a commit — lint errors, type errors, convention violations, secrets
detection, failing pre-commit hooks, or a rejected commit message.
**How to use it:**

```
/fix-commit
```

Run it right after a commit gets blocked. It reads the error output and fixes the root cause, not just the symptom.

### `architecture-documentation`

**What it does:** The one workflow for writing and updating architecture docs
and ADRs — where a document goes, whether a decision needs an ADR, whether a
diagram earns its place.
**When it kicks in:** Automatically, whenever a change alters module ownership
or boundaries, the auth/authorization model, persistence, an external
integration, or a cross-cutting convention. **This is mandatory, not advisory
— see [`CLAUDE.md`](../../CLAUDE.md).**
**Why it exists:** Without one workflow, every agent re-decides the format,
the location, and the ADR threshold. Different answers each time is exactly
how documentation drifts away from the code.
**How to use it:**

```
/architecture-documentation
```

Most changes are not architectural, and the skill's first question is designed
to let you out quickly.

### `fe-api-guide`

**What it does:** Generates a full frontend-integration package from this backend — one Markdown API guide, README
files per module, and a working interactive HTML demo app frontend devs can click through.
**How to use it:**

```
/fe-api-guide
```

Use this when the frontend team needs to understand how to call our endpoints, or when you want a live demo of
every module's flows (auth, uploads, chat, payments, etc).

---

## General engineering skills (from Matt Pocock's skill pack)

These are general-purpose software engineering workflows, vendored from
[github.com/mattpocock/skills](https://github.com/mattpocock/skills) and trimmed down to the ones that actually help
with backend coding (we removed `prototype` and `wizard` — mostly UI/infra-focused, not useful here). Most come
from that repo's `engineering/` set; `grilling` comes from its `productivity/` set, because `grill-with-docs`
is built on top of it.

### `tdd` — write code test-first

**What it does:** Walks through red → green → refactor: write a failing test, make it pass, then clean up.
**When to use it:** Starting a new feature or fixing a bug and you want tests driving the implementation.
**Example:**

```
/tdd add a rate limiter to the login endpoint
```

### `diagnosing-bugs` — find the root cause of something broken

**What it does:** A structured debugging loop instead of guess-and-check — forms a hypothesis, tests it, narrows
down the cause.
**When to use it:** Something is throwing, failing, or slow and you don't know why yet.
**Example:**

```
/diagnosing-bugs the /orders endpoint returns 500 intermittently under load
```

### `code-review` — review a branch or diff

**What it does:** Reviews your changes on two axes at once: does it follow our documented conventions
(`best-practices`), and does it actually do what the ticket/spec asked for. Runs both checks in parallel and reports
side by side.
**When to use it:** Before opening a PR, or reviewing someone else's branch.
**Runs on its own too.** A `Stop` hook ([`scripts/hooks/claude-auto-review.mjs`](../../scripts/hooks/claude-auto-review.mjs))
measures how much of `src/**` Claude changed and blocks it from ending the turn until the review has run — when a new
module folder appears, or 3+ `src/**.ts` files, or 150+ lines changed. Small fixes are left alone. It picks the fixed
point itself (merge-base with `main` on a branch, `origin/main` or the working tree on `main`) and won't re-fire on a
change set it already reviewed. Set `CLAUDE_SKIP_AUTO_REVIEW=1` to turn it off for a session.
**Example:**

```
/code-review since main
```

### `codebase-design` — improve a module's interface

**What it does:** Gives Claude (and you) a shared vocabulary for "deep modules" — simple interface, real
functionality hidden behind it. Helps decide where a seam/boundary should go, or how to make a service easier to
test.
**When to use it:** Refactoring a module, or a service/controller is getting hard to test or reason about.
**Example:**

```
/codebase-design our NotificationsService interface feels leaky, help me redesign it
```

### `improve-codebase-architecture` — find refactor opportunities

**What it does:** Scans the codebase for places that could be "deepened" (better abstractions, less leaky
interfaces), shows you a visual HTML report of candidates, then lets you drill into whichever one you pick.
**When to use it:** Periodic architecture health-check, or onboarding onto a part of the codebase you don't know
well.
**Example:**

```
/improve-codebase-architecture scan src/modules
```

### `domain-modeling` — keep our terminology and decisions straight

**What it does:** Builds and maintains `CONTEXT.md` (a glossary of our domain terms) and `docs/adr/` (Architecture
Decision Records — short docs explaining _why_ we chose something, e.g. "why Mongoose over Prisma").
**When to use it:** You're about to name something ambiguous, or you just made an architectural call worth
recording.
**Example:**

```
/domain-modeling what do we mean by "workspace" vs "organization" in this codebase?
```

### `grilling` — think an idea through before building it

**What it does:** Interviews you about a plan or idea in **rounds**. It maps the design as a tree of decisions and
asks every question that's currently answerable in one batch — each numbered, each with Claude's recommended
answer — then waits for you before the next round. It looks up facts about the codebase itself rather than asking
you, and won't start building until you confirm you've reached a shared understanding.
**When to use it:** The closest thing we have to "brainstorm this with me." Use it at the start of any feature
where the requirements aren't nailed down yet. Claude will often reach for it on its own when you say "let's
build X".
**Example:**

```
/grilling I want to add a reviews-and-ratings feature to user profiles
```

**Why not the Superpowers `brainstorming` skill?** If you have the Superpowers plugin installed globally, it ships
a `brainstorming` skill that covers the same ground — so `settings.json` turns it off for this repo. Two skills
competing for the same trigger means whichever fires is a coin flip, and your teammates (who only have what's in
this repo) would get different behaviour from you. We keep `grilling` because it's the one that fits: it feeds the
rest of our chain (`/to-spec` → `/to-tickets` → `/implement`), whereas `brainstorming` ends by handing off to a
`writing-plans` skill we don't have, and writes its spec to its own folder instead of a GitHub issue or an ADR.

The one thing `brainstorming` did better: it sized the ceremony to the job, treating a quick feasibility check
differently from a new subsystem. `grilling` has a single gear. In practice a small change just has a small
decision tree, so it wraps up quickly — but if it starts interviewing you about a one-line fix, just say so and
tell it to get on with it.

### `grill-with-docs` — pressure-test a plan before building it

**What it does:** `grilling` plus `domain-modeling` — the same round-based interview, but it also writes the
outcome up as an ADR/glossary entry as you go.
**When to use it:** Before starting something big and irreversible (a schema migration, a new auth flow) — cheaper
to find the flaw now than after it's built.
**Example:**

```
/grill-with-docs I'm planning to move refresh tokens from cookies to headers
```

### `resolving-merge-conflicts` — untangle a bad merge/rebase

**What it does:** Works through an in-progress git merge or rebase conflict for you.
**When to use it:** You're mid-merge or mid-rebase and `git status` shows conflicted files.
**Example:**

```
/resolving-merge-conflicts
```

### `research` — look something up properly

**What it does:** Investigates a technical question against real primary sources (official docs, RFCs, source code)
and saves the findings as a Markdown file in the repo, instead of answering from memory.
**When to use it:** "How does X library actually handle Y" — questions where a wrong guess is expensive.
**Example:**

```
/research what's the correct way to handle idempotency keys with Stripe webhooks
```

### `implement` — build from a spec or ticket

**What it does:** Takes an already-written spec or set of tickets and implements it, without re-litigating the
design.
**When to use it:** The spec/ticket is already agreed on and you just need it built.
**Example:**

```
/implement ticket #42
```

### `ask-matt` — "which skill do I want?"

**What it does:** A router. Describe your situation and it tells you which skill fits.
**Example:**

```
/ask-matt I have a huge messy feature to build, not sure where to start
```

### `setup-matt-pocock-skills` — reconfigure this setup

**What it does:** The skill that generated the files in `docs/agents/` (issue tracker, triage labels, domain doc
layout) and this guide's skill list. Only needed again if we switch issue trackers or want to redo the setup from
scratch.
**Example:**

```
/setup-matt-pocock-skills
```

---

## Issue-tracker workflow skills

These write to and read from **GitHub Issues** on `gamm-boilerplates/backend` (see
[`docs/agents/issue-tracker.md`](issue-tracker.md)), using the `gh` CLI. You need `gh` installed and authenticated
(`brew install gh && gh auth login`) for these to actually create/edit issues.

### `to-spec` — turn a conversation into a spec

**What it does:** Synthesizes what you've already discussed with Claude into a written spec and publishes it as a
GitHub issue — no extra interview, just writes down the decisions you already made.
**Example:**

```
/to-spec
```

(after discussing a feature's design in the chat)

### `to-tickets` — break a plan into tickets

**What it does:** Splits a plan/spec into small "tracer-bullet" tickets — each one independently shippable, each
declaring what it's blocked by — and publishes them as GitHub issues with real blocking links.
**Example:**

```
/to-tickets break down the "add 2FA" plan into tickets
```

### `triage` — process incoming issues and PRs

**What it does:** Walks issues (and external PRs) through a 5-stage state machine, applying one of five labels at
each stage so anyone — human or agent — can see at a glance what's ready to work on.

**The five labels, in plain English:**

| Label             | Meaning                                                                       | What happens next                        |
| ----------------- | ----------------------------------------------------------------------------- | ---------------------------------------- |
| `needs-triage`    | Nobody's looked at this yet                                                   | A maintainer (or `/triage`) evaluates it |
| `needs-info`      | We asked the reporter something and are waiting                               | Sits here until they reply               |
| `ready-for-agent` | Fully specified — clear enough that an AI agent could pick it up unsupervised | Anyone can run `/implement` against it   |
| `ready-for-human` | Needs a person — too ambiguous, too risky, or needs a judgment call           | Goes in a human's queue                  |
| `wontfix`         | Decided we're not doing this                                                  | Closed, no further action                |

**Example — triaging the whole open queue:**

```
/triage
```

Claude reads every open issue labelled `needs-triage`, evaluates each one, and re-labels it `needs-info`,
`ready-for-agent`, `ready-for-human`, or `wontfix` — leaving a comment explaining why.

**Example — triaging one issue:**

```
/triage #57
```

Label strings are configured in [`docs/agents/triage-labels.md`](triage-labels.md) — currently the defaults
(no renaming), so what you see on GitHub is exactly the table above.

### `wayfinder` — plan work too big for one session

**What it does:** For work that spans many sessions (a big migration, a new subsystem), creates a "map" issue with
child ticket issues and blocking edges, then works through them one at a time, tracking decisions as it goes.
**When to reach for it:** not when the work is _big_, but when making the issue implementation-ready would mean
guessing a decision nobody has made yet. If ownership, constraints and acceptance criteria are already clear, use a
normal issue instead.
**Full guide:** [`docs/guides/wayfinder.md`](../guides/wayfinder.md) — the two invocation modes, the four ticket
types, destination/map/frontier/fog, and the hand-off into normal implementation tickets.
**Example:**

```
/wayfinder plan the migration off the legacy email service
```

---

## Quick reference

| I want to...                                    | Run                              |
| ----------------------------------------------- | -------------------------------- |
| Write a feature test-first                      | `/tdd`                           |
| Find why something's broken                     | `/diagnosing-bugs`               |
| Review my branch before a PR                    | `/code-review`                   |
| Redesign a messy module                         | `/codebase-design`               |
| Find refactor opportunities                     | `/improve-codebase-architecture` |
| Define/clarify a domain term                    | `/domain-modeling`               |
| Brainstorm a feature before writing it          | `/grilling`                      |
| Same, but record the outcome as an ADR          | `/grill-with-docs`               |
| Fix a merge conflict                            | `/resolving-merge-conflicts`     |
| Research a technical question properly          | `/research`                      |
| Build from an existing spec/ticket              | `/implement`                     |
| Figure out which skill I want                   | `/ask-matt`                      |
| Fix a blocked commit                            | `/fix-commit`                    |
| Generate the frontend API guide/demo            | `/fe-api-guide`                  |
| Document an architecture change or write an ADR | `/architecture-documentation`    |
| Turn a discussion into a spec (GitHub issue)    | `/to-spec`                       |
| Break a plan into tickets (GitHub issues)       | `/to-tickets`                    |
| Process the open-issue queue                    | `/triage`                        |
| Plan multi-session work                         | `/wayfinder`                     |
