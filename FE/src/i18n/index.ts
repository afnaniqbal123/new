import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/common.json';

/*
 * i18next, JSON-file-backed. This is the ONLY source of user-facing text — never
 * hardcode a string in a component; add a key to locales/<lng>/common.json and read it
 * with useTranslation()'s t() (or i18n.t() outside a component, e.g. in a Zod schema).
 *
 * Adding a new language later:
 *   1. Copy locales/en/common.json to locales/<lng>/common.json and translate the values
 *      (keys must match exactly).
 *   2. Add it to `resources` below: `<lng>: { common: <lng>Common }`.
 *   3. Add `<lng>` wherever the UI offers a language switcher.
 * No component changes needed — every t('KEY') call resolves against whichever
 * language is active.
 */
export const defaultNS = 'common';

export const resources = {
  en: { common: en },
} as const;

/**
 * Every valid `t()` key. For a data-driven i18n key — e.g. a nav-item config
 * storing which key to resolve later, rather than a component calling `t('KEY')`
 * directly — type the field as `TranslationKey` instead of `string`, so a typo
 * or a key that doesn't exist is still a compile error (`t()` itself only
 * accepts a literal, never a plain `string`, once a key is stored in a variable).
 */
export type TranslationKey = keyof typeof en;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  interpolation: { escapeValue: false },
});

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['en'];
  }
}

export default i18n;
