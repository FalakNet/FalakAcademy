import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type ColorBlindType = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

interface SettingsContextType {
  theme: Theme;
  colorBlindType: ColorBlindType;
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: number;
  setTheme: (theme: Theme) => void;
  setColorBlindType: (type: ColorBlindType) => void;
  setHighContrast: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setFontSize: (size: number) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [colorBlindType, setColorBlindTypeState] = useState<ColorBlindType>('none');
  const [highContrast, setHighContrastState] = useState(false);
  const [reducedMotion, setReducedMotionState] = useState(false);
  const [fontSize, setFontSizeState] = useState(16);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    const savedColorBlind = localStorage.getItem('colorBlindType') as ColorBlindType;
    const savedHighContrast = localStorage.getItem('highContrast') === 'true';
    const savedReducedMotion = localStorage.getItem('reducedMotion') === 'true';
    const savedFontSize = parseInt(localStorage.getItem('fontSize') || '16');

    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setThemeState(savedTheme);
    }
    if (savedColorBlind) {
      setColorBlindTypeState(savedColorBlind);
    }
    setHighContrastState(savedHighContrast);
    setReducedMotionState(savedReducedMotion);
    setFontSizeState(savedFontSize);
    setIsInitialized(true);
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (!isInitialized) return;
    
    const root = document.documentElement;
    const body = document.body;
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');
    
    // Apply new theme
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.add('light');
      body.classList.add('light');
    }
    
    // Set color scheme
    root.style.colorScheme = theme;
    
    // Save to localStorage
    localStorage.setItem('theme', theme);
  }, [theme, isInitialized]);

  // Apply colorblind filters
  useEffect(() => {
    if (!isInitialized) return;
    
    const root = document.documentElement;
    
    // Remove existing colorblind classes
    root.classList.remove('protanopia', 'deuteranopia', 'tritanopia');
    
    if (colorBlindType !== 'none') {
      root.classList.add(colorBlindType);
    }
    
    localStorage.setItem('colorBlindType', colorBlindType);
  }, [colorBlindType, isInitialized]);

  // Apply high contrast
  useEffect(() => {
    if (!isInitialized) return;
    
    const root = document.documentElement;
    
    if (highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    localStorage.setItem('highContrast', highContrast.toString());
  }, [highContrast, isInitialized]);

  // Apply reduced motion
  useEffect(() => {
    if (!isInitialized) return;
    
    const root = document.documentElement;
    
    if (reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
    
    localStorage.setItem('reducedMotion', reducedMotion.toString());
  }, [reducedMotion, isInitialized]);

  // Apply font size
  useEffect(() => {
    if (!isInitialized) return;
    
    const root = document.documentElement;
    root.style.fontSize = `${fontSize}px`;
    localStorage.setItem('fontSize', fontSize.toString());
  }, [fontSize, isInitialized]);

  // Wrapper functions to update state and localStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setColorBlindType = (newType: ColorBlindType) => {
    setColorBlindTypeState(newType);
  };

  const setHighContrast = (enabled: boolean) => {
    setHighContrastState(enabled);
  };

  const setReducedMotion = (enabled: boolean) => {
    setReducedMotionState(enabled);
  };

  const setFontSize = (size: number) => {
    setFontSizeState(size);
  };

  const value = {
    theme,
    colorBlindType,
    highContrast,
    reducedMotion,
    fontSize,
    setTheme,
    setColorBlindType,
    setHighContrast,
    setReducedMotion,
    setFontSize,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}