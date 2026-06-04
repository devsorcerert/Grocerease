import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language } from '../constants/translations';

interface LanguageContextType {
  language: Language;
  changeLanguage: (lang: Language) => Promise<void>;
  t: (key: keyof typeof translations['en']) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    // Load stored language preference
    const loadLanguage = async () => {
      try {
        const storedLang = await AsyncStorage.getItem('user_language');
        if (storedLang && (storedLang === 'en' || storedLang === 'hi' || storedLang === 'te')) {
          setLanguage(storedLang as Language);
        }
      } catch (error) {
        console.error('Failed to load language preference:', error);
      }
    };
    loadLanguage();
  }, []);

  const changeLanguage = async (lang: Language) => {
    try {
      setLanguage(lang);
      await AsyncStorage.setItem('user_language', lang);
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  };

  const t = (key: keyof typeof translations['en']): string => {
    const translationSet = translations[language] || translations['en'];
    return translationSet[key] || translations['en'][key] || String(key);
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
