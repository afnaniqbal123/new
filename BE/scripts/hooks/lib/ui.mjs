/**
 * Terminal presentation helpers for the git hooks.
 *
 * A quality gate is only as good as its error messages: if a blocked commit
 * prints a wall of tool output, developers reach for `--no-verify` and the gate
 * stops existing. Everything here exists to make a failure readable in five
 * seconds — what broke, where, and the exact next action.
 */
import process from 'node:process';

// lint-staged pipes child output, which hides the TTY. The orchestrator sets
// FORCE_COLOR when it owns a real terminal so nested tools stay readable.
const SUPPORTS_COLOR =
  !process.env.NO_COLOR &&
  process.env.TERM !== 'dumb' &&
  (Boolean(process.stdout.isTTY) ||
    (Boolean(process.env.FORCE_COLOR) && process.env.FORCE_COLOR !== '0'));

function wrap(open, close) {
  return (text) =>
    SUPPORTS_COLOR ? `[${open}m${text}[${close}m` : String(text);
}

export const color = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
};

export const symbol = {
  pass: color.green('✔'),
  fail: color.red('✖'),
  warn: color.yellow('!'),
  skip: color.gray('–'),
  arrow: color.cyan('→'),
  bullet: color.gray('•'),
};

export function line(text = '') {
  process.stdout.write(`${text}\n`);
}

/** A titled banner used for the final pass/fail verdict. */
export function banner(title, subtitle, tone = 'red') {
  const paint = color[tone] ?? color.red;
  const rule = '─'.repeat(64);
  line();
  line(paint(rule));
  line(paint(color.bold(`  ${title}`)));
  if (subtitle) line(color.gray(`  ${subtitle}`));
  line(paint(rule));
}

/** Section heading for one group of findings. */
export function section(title, count) {
  line();
  line(`${color.red('✖')} ${color.bold(title)} ${color.gray(`(${count})`)}`);
  line();
}

/** `file:line` in the format editors and terminals make clickable. */
export function location(file, lineNo, columnNo) {
  const position = [lineNo, columnNo].filter(Boolean).join(':');
  return color.cyan(position ? `${file}:${position}` : file);
}

/** Wrap prose to a readable width, indenting continuation lines. */
export function wrapText(text, indent = '    ', width = 84) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > width - indent.length) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);

  return lines.map((l) => `${indent}${l}`).join('\n');
}

/** Render one finding: where, what, and how to fix it. */
export function finding({ file, line: lineNo, column, message, hint, docs }) {
  line(`  ${location(file, lineNo, column)}`);
  line(wrapText(message, '    '));
  if (hint) line(color.green(wrapText(`${symbol.arrow} ${hint}`, '    ')));
  if (docs) line(color.gray(`    ${symbol.bullet} Read: ${docs}`));
  line();
}

/** A single-line progress row, e.g. "✔ Type safety            1.4s". */
export function step(status, label, detail = '') {
  const icon = {
    pass: symbol.pass,
    fail: symbol.fail,
    warn: symbol.warn,
    skip: symbol.skip,
  }[status];
  const padded = label.padEnd(26, ' ');
  line(`  ${icon} ${padded}${color.gray(detail)}`);
}

export function duration(ms) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
