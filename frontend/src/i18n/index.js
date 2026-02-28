/**
 * Configuration i18next pour l'internationalisation du frontend.
 * Détection automatique via navigateur + persistance localStorage.
 * Langues supportées : EN (fallback), FR, NL.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import fr from './locales/fr.json';
import nl from './locales/nl.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      nl: { translation: nl },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'nl'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'mcv-language',
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
