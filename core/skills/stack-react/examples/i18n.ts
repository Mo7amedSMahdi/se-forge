import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar.json';
import en from './en.json';

export const languages = { ar: { dir: 'rtl', label: 'العربية' }, en: { dir: 'ltr', label: 'English' } } as const;
export type Language = keyof typeof languages;

// The document follows the language: lang and dir, so CSS logical properties flip the layout.
export function applyLanguage(lng: string) {
  const l = (lng in languages ? lng : 'ar') as Language;
  document.documentElement.lang = l;
  document.documentElement.dir = languages[l].dir;
}

i18n.on('languageChanged', applyLanguage);
await i18n.use(initReactI18next).init({ resources: { ar: { translation: ar }, en: { translation: en } }, lng: 'ar', fallbackLng: 'ar', interpolation: { escapeValue: false } });
applyLanguage(i18n.language);

export default i18n;
