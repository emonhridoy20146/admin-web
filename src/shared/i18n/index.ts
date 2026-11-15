import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import commonBn from './common.bn.json';
import commonEn from './common.en.json';
import type { Locale } from '../lib/format';

let initialised = false;

/** Feature namespaces are passed in by the app (shared never imports features). */
export function initI18n(featureMessages: Record<string, { bn: object; en: object }>, lng: Locale) {
  if (initialised) return i18n;
  const resources: Resource = { bn: { common: commonBn }, en: { common: commonEn } };
  for (const [ns, m] of Object.entries(featureMessages)) {
    resources.bn![ns] = m.bn as Record<string, string>;
    resources.en![ns] = m.en as Record<string, string>;
  }
  void i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', ...Object.keys(featureMessages)],
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  initialised = true;
  return i18n;
}

export { i18n };
