---
name: fe-a11y-audit
description: Use when auditing a component or route for accessibility. Runs the strict jsx-a11y lint pass, then reports WCAG 2.1 AA violations in plain language with concrete fixes — never by suppressing rules.
---

# Accessibility audit (WCAG 2.1 AA)

Authoritative checklist: `AGENTS.md` § Accessibility.

## Procedure

1. **Static pass:** `pnpm exec eslint --config eslint.a11y.config.js <path>` (strict jsx-a11y).
2. **Manual pass:** read the markup against the checklist below — this boilerplate has no
   automated a11y test framework, so this is where real judgment (labeling, focus order,
   keyboard reachability) has to happen.
3. **Report** each finding against the checklist below, in plain language, with the exact fix.

## Checklist

- Images: `alt` present (or `alt="" aria-hidden="true"` for decorative).
- Forms: every input labeled (`htmlFor`/wrap); errors via `aria-describedby` + `role="alert"`.
- Buttons: explicit `type`; non-button click targets have keyboard handlers (Enter/Space).
- Headings: no skipped levels. Contrast ≥ 4.5:1 / 3:1. Focus always visible.
- Semantics first; ARIA only where semantic HTML falls short.

## Rule

Fix the markup. Never disable an a11y rule to make the audit pass.
