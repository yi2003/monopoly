// ============================================================
// useI18n — Simple React i18n hook
// ============================================================

import { useCallback } from 'react';
import { useUIStore } from '../store/uiStore';
import { translations, formatT, type Lang, type TranslationKey } from './translations';

export function useI18n() {
  const lang = useUIStore(s => s.language);

  const t = useCallback((key: TranslationKey, vars?: Record<string, string | number>): string => {
    const text = translations[lang][key] || translations.zh[key] || key;
    return formatT(text, vars);
  }, [lang]);

  const switchLang = useCallback(() => {
    const next: Lang = lang === 'zh' ? 'en' : 'zh';
    useUIStore.getState().setLanguage(next);
  }, [lang]);

  /** Pick localized name from an object with nameCN + name/nameEN fields */
  const localName = useCallback((obj: { nameCN?: string; nameEN?: string; name?: string } | null | undefined): string => {
    if (!obj) return '';
    return lang === 'zh' ? (obj.nameCN || '') : (obj.nameEN || obj.name || obj.nameCN || '');
  }, [lang]);

  return { t, lang, switchLang, localName };
}

/** Non-reactive version for use outside React components */
export function getI18n() {
  const lang = useUIStore.getState().language;
  return {
    lang,
    t: (key: TranslationKey, vars?: Record<string, string | number>): string => {
      const text = translations[lang][key] || translations.zh[key] || key;
      return formatT(text, vars);
    },
  };
}
