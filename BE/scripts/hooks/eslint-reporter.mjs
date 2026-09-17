/**
 * Custom ESLint formatter used by the pre-commit gate.
 *
 * The stock formatter prints a rule id and expects you to look it up. This one
 * prints the violation, a concrete fix, and the convention document that
 * explains why the rule exists — so a blocked commit teaches the convention
 * instead of just denying the commit.
 *
 * @see .claude/skills/best-practices/
 */
import path from 'node:path';
import {
  RULE_GUIDANCE,
  STOCK_RULE_HINTS,
} from '../../tools/eslint-rules/guidance.mjs';
import { color, symbol, wrapText } from './lib/ui.mjs';

/** Rules whose violations the auto-fixer already handles — never worth prose. */
const AUTOFIXED_RULES = new Set(['prettier/prettier', 'quotes']);

function relative(filePath) {
  return path.relative(process.cwd(), filePath) || filePath;
}

function hintFor(ruleId) {
  if (!ruleId) return null;
  return STOCK_RULE_HINTS[ruleId] ?? null;
}

export default function format(results) {
  const files = results.filter((r) => r.errorCount > 0 || r.warningCount > 0);
  if (files.length === 0) return '';

  const out = [];
  let errors = 0;
  let warnings = 0;
  let conventionViolations = 0;

  for (const result of files) {
    const messages = [...result.messages].sort((a, b) => a.line - b.line);
    if (messages.length === 0) continue;

    out.push('');
    out.push(`  ${color.bold(color.cyan(relative(result.filePath)))}`);

    for (const message of messages) {
      const isError = message.severity === 2;
      if (isError) errors += 1;
      else warnings += 1;

      const ruleId = message.ruleId ?? 'eslint';
      const isConvention = ruleId.startsWith('nestjs/');
      if (isConvention) conventionViolations += 1;

      const position = color.gray(`${message.line}:${message.column}`);
      const label = isError ? color.red('error') : color.yellow('warn ');
      const tag = isConvention ? color.magenta(' [convention]') : '';

      out.push(`    ${position}  ${label}${tag}`);
      out.push(color.dim(wrapText(message.message, '      ')));

      const hint = hintFor(ruleId);
      if (hint && !AUTOFIXED_RULES.has(ruleId)) {
        out.push(color.green(wrapText(`${symbol.arrow} ${hint}`, '      ')));
      }

      const docs = RULE_GUIDANCE[ruleId];
      if (docs) {
        out.push(color.gray(`      ${symbol.bullet} Convention: ${docs}`));
      }

      out.push(color.gray(`      ${symbol.bullet} Rule: ${ruleId}`));
      out.push('');
    }
  }

  const parts = [];
  if (errors)
    parts.push(color.red(`${errors} error${errors === 1 ? '' : 's'}`));
  if (warnings)
    parts.push(color.yellow(`${warnings} warning${warnings === 1 ? '' : 's'}`));

  out.push(`  ${parts.join(color.gray(' · '))}`);
  if (conventionViolations > 0) {
    out.push(
      color.gray(
        `  ${conventionViolations} of them break a documented project convention (marked [convention]).`,
      ),
    );
  }
  out.push('');

  return out.join('\n');
}
