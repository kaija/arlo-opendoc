import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { InterfaceLanguage } from '@arlo-doc/shared';
import en from './locales/en.json';
import zhHant from './locales/zh-Hant.json';
import ja from './locales/ja.json';

/**
 * The interface languages that actually ship a catalogue. `system` is not one
 * of them — it resolves to one of these at runtime (see resolveLanguage).
 */
export const SUPPORTED_LANGUAGES = ['en', 'zh-Hant', 'ja'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * Maps a BCP-47 tag from the OS (navigator.language) onto the closest catalogue
 * we ship. Only Traditional Chinese is bundled, so Simplified locales fall back
 * to English rather than being shown a script the reader may not use.
 */
export function normaliseLocale(tag: string | undefined | null): SupportedLanguage {
  if (!tag) return DEFAULT_LANGUAGE;
  const lower = tag.toLowerCase();
  if (lower.startsWith('ja')) return 'ja';
  if (lower.startsWith('zh')) {
    // zh-Hant, zh-TW, zh-HK, zh-MO and a bare "zh" → Traditional.
    // zh-Hans, zh-CN, zh-SG → English (no Simplified catalogue).
    if (
      lower.includes('hant') ||
      lower.includes('-tw') ||
      lower.includes('-hk') ||
      lower.includes('-mo') ||
      lower === 'zh'
    ) {
      return 'zh-Hant';
    }
    return DEFAULT_LANGUAGE;
  }
  return DEFAULT_LANGUAGE;
}

/** The OS UI locale, as Chromium reports it to the renderer. */
export function systemLocale(): SupportedLanguage {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const candidates = [
    ...(nav?.languages ?? []),
    nav?.language,
  ].filter((x): x is string => typeof x === 'string' && x.length > 0);
  for (const candidate of candidates) {
    const resolved = normaliseLocale(candidate);
    if (resolved !== DEFAULT_LANGUAGE) return resolved;
  }
  return DEFAULT_LANGUAGE;
}

/** Turns the stored `interfaceLanguage` setting into a concrete catalogue. */
export function resolveLanguage(setting: InterfaceLanguage | undefined): SupportedLanguage {
  if (setting === undefined || setting === 'system') return systemLocale();
  return setting;
}

void i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-Hant': { translation: zhHant },
    ja: { translation: ja },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  // The renderer paints text synchronously on first mount; a Suspense fallback
  // would just flash. Resources are bundled, so init is synchronous anyway.
  initImmediate: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  returnEmptyString: false,
});

export default i18next;
