import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
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
  const [theme, setThemeState] = useState<Theme>('system');
  const [colorBlindType, setColorBlindTypeState] = useState<ColorBlindType>('none');
  const [highContrast, setHighContrastState] = useState(false);
  const [reducedMotion, setReducedMotionState] = useState(false);
  const [fontSize, setFontSizeState] = useState(16);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    // Set default theme to 'system' if not set
    const savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
      localStorage.setItem('theme', 'system');
    }
    const savedColorBlind = localStorage.getItem('colorBlindType') as ColorBlindType;
    const savedHighContrast = localStorage.getItem('highContrast') === 'true';
    const savedReducedMotion = localStorage.getItem('reducedMotion') === 'true';
    const savedFontSize = parseInt(localStorage.getItem('fontSize') || '16');

    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
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

  // Detect system theme if theme is 'system'
  useEffect(() => {
    if (!isInitialized) return;
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const applySystemTheme = () => {
      const root = document.documentElement;
      const body = document.body;
      root.classList.remove('light', 'dark');
      body.classList.remove('light', 'dark');
      if (mql.matches) {
        root.classList.add('dark');
        body.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.add('light');
        body.classList.add('light');
        root.style.colorScheme = 'light';
      }
    };
    applySystemTheme();
    mql.addEventListener('change', applySystemTheme);
    return () => mql.removeEventListener('change', applySystemTheme);
  }, [theme, isInitialized]);

  // Apply theme to document
  useEffect(() => {
    if (!isInitialized) return;
    if (theme === 'system') return; // handled above
    const root = document.documentElement;
    const body = document.body;
    root.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.add('light');
      body.classList.add('light');
    }
    root.style.colorScheme = theme;
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