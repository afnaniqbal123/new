import { defineConfig } from 'react-doctor/api';

/*
 * Project-level React Doctor config. Rules run at their recommended defaults —
 * tune here only for a repo-wide reason (AGENTS.md § Never Do: no per-project
 * workarounds). `.github/workflows/react-doctor.yml` (via `react-doctor ci install`)
 * and the pre-commit gate's React Diagnostics stage both read this file.
 */
export default defineConfig({
  blocking: 'error',
  ignore: {
    // MSW fixtures are intentionally fake data, not production code paths.
    files: ['src/mocks/**'],
  },
  rules: {
    // Every rule below is promoted warn → error because it has NO equivalent in
    // strict jsx-a11y (verified by diffing react-doctor's Accessibility rule set
    // against `jsxA11y.flatConfigs.strict.rules`) — for these, react-doctor is the
    // only net that exists, so leaving them at "warn" means they never actually
    // block anything. Checked against a full scan of every file in src/ first:
    // none of these currently fire, including on the Radix `asChild`/Slot
    // composition this repo uses (Button, Dialog, ConfirmDialog) — promoting them
    // costs nothing today and closes a real class of gap going forward.
    //
    // Found via the boilerplate's own QA pass — a bare control with no name at all:
    'react-doctor/control-has-associated-label': 'error',
    // Same shape of gap, same reasoning, for the rest of this repo's actual surface
    // (Radix Dialog everywhere, two <nav>/<main> landmarks across layouts, every
    // common component that sets its own aria-label):
    'react-doctor/dialog-has-accessible-name': 'error',
    'react-doctor/no-multiple-main-landmarks': 'error',
    'react-doctor/no-multiple-unlabeled-navigation-landmarks': 'error',
    'react-doctor/no-focusable-content-in-aria-hidden': 'error',
    'react-doctor/no-aria-hidden-on-focusable': 'error',
    'react-doctor/no-uninformative-aria-label': 'error',
    'react-doctor/no-responsive-hidden-accessible-name': 'error',
    'react-doctor/no-assertive-status': 'error',
    'react-doctor/role-button-requires-complete-keyboard-activation': 'error',
    'react-doctor/radio-input-missing-name': 'error',
    'react-doctor/anchor-ambiguous-text': 'error',
    'react-doctor/anchor-target-exists': 'error',
    // Deliberately NOT promoted:
    //   prefer-html-dialog, prefer-tag-over-role — these are style preferences
    //   that conflict with AGENTS.md's own "reach for a Radix primitive for
    //   dialogs" convention; promoting them would fight our own rulebook.
    //   html-no-nested-interactive — real risk of a false positive against the
    //   Slot/asChild composition pattern (ConfirmDialog, DialogTrigger); needs
    //   validation against a real asChild misuse case before blocking on it.
    //   no-autoplay-without-muted, lang — not applicable (no media in this repo;
    //   `lang` is a document-level, one-time `index.html` concern, not a
    //   per-component risk this gate is positioned to catch).
  },
});
