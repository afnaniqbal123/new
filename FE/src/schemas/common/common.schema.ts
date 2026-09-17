import { z } from 'zod';
import i18n from 'src/i18n';

/**
 * Reusable primitive validators, composed into feature schemas instead of each
 * one redefining email/password/phone rules — the pattern both Glassatecture
 * (`schemas/common.ts`) and CarnectionIQ (per-field validator utils) converge
 * on independently. Keep this file to genuinely generic primitives only.
 *
 * Outside a component, so these read the i18next instance directly (`i18n.t()`)
 * instead of the useTranslation() hook.
 *
 * Zod v4: top-level string formats (`z.email()`, `z.url()`), not the deprecated
 * `z.string().email()`/`.url()` chained form — see AGENTS.md § Data & State.
 */
export const emailSchema = z
  .string()
  .trim()
  .pipe(z.email(i18n.t('FORM_INVALID_EMAIL')));

export const passwordSchema = z
  .string()
  .min(8, i18n.t('FORM_TOO_SHORT'))
  .regex(/[A-Z]/, i18n.t('FORM_PASSWORD_WEAK'))
  .regex(/[0-9]/, i18n.t('FORM_PASSWORD_WEAK'));

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, i18n.t('FORM_INVALID_PHONE'));

export const urlSchema = z
  .string()
  .trim()
  .pipe(z.url(i18n.t('FORM_INVALID_URL')));
