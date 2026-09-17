/**
 * Runs both halves of the monorepo in one terminal, with prefixed output.
 *
 * BE and FE are deliberately NOT a pnpm workspace: each ships its own
 * `pnpm-workspace.yaml` carrying supply-chain hardening (minimumReleaseAge,
 * allowBuilds) that a root workspace file would silently override. So this
 * script orchestrates two independent dev servers instead.
 */
import { spawn } from 'node:child_process';

const RESET = '[0m';

const targets = [
  { name: 'BE', color: '[36m', dir: 'BE', script: 'start:dev' },
  { name: 'FE', color: '[35m', dir: 'FE', script: 'dev' },
];

const children = targets.map(({ name, color, dir, script }) => {
  const child = spawn('pnpm', ['-C', dir, 'run', script], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const prefix = `${color}[${name}]${RESET} `;
  const pipe = (stream, out) => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) out.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}exited with code ${String(code)}\n`);
  });
  return child;
});

const shutdown = () => {
  for (const child of children) child.kill('SIGTERM');
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
