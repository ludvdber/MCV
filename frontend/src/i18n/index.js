/**
 * Configuration i18next pour l'internationalisation du frontend.
 * Détection automatique via navigateur + persistance localStorage.
 * Langues supportées : EN (fallback), FR, NL, ES, DE.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import fr from './locales/fr.json';
import nl from './locales/nl.json';
import es from './locales/es.json';
import de from './locales/de.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      nl: { translation: nl },
      es: { translation: es },
      de: { translation: de },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'nl', 'es', 'de'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'mcv-language',
    },
    keySeparator: false,
    interpolation: { escapeValue: false },
  });

export default i18n;
