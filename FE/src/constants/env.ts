import { z } from 'zod';

/**
 * Validates `import.meta.env` once at module load, so a misconfigured deploy
 * fails loudly at startup instead of silently shipping an empty API base URL or
 * a stray `ENABLE_MOCKS` typo to production. Three of our four real projects
 * skip this entirely (raw `import.meta.env.VITE_X` access, no schema) — one
 * even shipped dead CRA-style `process.env` code as a result. This is the
 * boilerplate closing that gap.
 */
const envSchema = z.object({
  VITE_API_BASE_URL: z.string().default(''),
  VITE_ENABLE_MOCKS: z.enum(['true', 'false']).default('true'),
  // Set only by `.env.e2e` (via `pnpm build:e2e`'s `--mode e2e`) — never by a
  // real deploy. Lets the production-mode build still start the MSW browser
  // worker for Playwright, without weakening `import.meta.env.DEV`'s own
  // build-time truthiness for every other prod build (see main.tsx).
  VITE_E2E: z.enum(['true', 'false']).default('false'),
  /**
   * How the seeded demo team's addresses are spelled, with `{role}` standing
   * in for the lower-cased role name.
   *
   * Only ever read by the development-only quick-fill on the sign-in screen.
   * It is a setting rather than a constant because the demo seed is routinely
   * pointed at a real mailbox — plus-addressing (`me+owner@example.com`) is
   * the usual way to make verification emails actually arrive — and a
   * quick-fill that types addresses which do not exist is worse than none.
   */
  VITE_DEMO_EMAIL_PATTERN: z.string().default('{role}@kolachi.test'),
});

function parseEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(import.meta.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

export const ENV = parseEnv();
