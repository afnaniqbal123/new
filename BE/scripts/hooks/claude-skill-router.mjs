#!/usr/bin/env node
/**
 * Claude Code UserPromptSubmit hook.
 *
 * Fires on every prompt in this repo and injects a short pointer to
 * docs/agents/skills-guide.md so skill routing stays consistent even after
 * CLAUDE.md drops out of context on long sessions (compaction). Kept short
 * on purpose — this is injected on every turn, so it costs tokens every turn.
 *
 * Wired up via .claude/settings.json -> hooks.UserPromptSubmit.
 */
const reminder = `[skill-router] NestJS backend repo. For any src/** change: follow \`best-practices\` conventions proactively (ESLint/tsc enforce them at commit time, but fix-after-the-fact is more expensive than doing it right the first time). Check docs/agents/skills-guide.md's quick-reference table for the matching skill (tdd for new features/bugfixes, diagnosing-bugs for debugging, codebase-design for refactors, domain-modeling for terminology/ADRs). Run code-review on your own diff before calling a coding task done.`;

console.log(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: reminder,
    },
  }),
);
