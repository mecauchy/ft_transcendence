import i18n from '../i18n';

/**
 * Utility to get translations in Phaser scenes (outside of React components)
 */
export const t = (key: string): string => {
  return i18n.t(key);
};

/**
 * Get current language
 */
export const getCurrentLanguage = (): string => {
  return i18n.language;
};

/**
 * Subscribe to language changes
 */
export const onLanguageChange = (callback: (lng: string) => void): (() => void) => {
  i18n.on('languageChanged', callback);
  return () => i18n.off('languageChanged', callback);
};

export default { t, getCurrentLanguage, onLanguageChange };
