import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface PlatformSettings {
  site_name: string;
  site_description: string;
  site_logo_url: string | null;
  site_favicon_url: string | null;
  login_splash_image_url: string | null;
  primary_color: string;
  secondary_color: string;
  footer_text: string;
  support_email: string;
  terms_url: string | null;
  privacy_url: string | null;
  allow_public_registration: boolean;
  require_email_verification: boolean;
  enable_certificates: boolean;
  enable_quizzes: boolean;
  maintenance_mode: boolean;
}

interface PlatformSettingsContextType {
  settings: PlatformSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  getAssetUrl: (path: string | null) => string | null;
}

const defaultSettings: PlatformSettings = {
  site_name: 'Falak Academy',
  site_description: 'Professional Learning Management System',
  site_logo_url: 'site_logo_url_1750248260516.svg',
  site_favicon_url: null,
  login_splash_image_url: null,
  primary_color: '#2563eb',
  secondary_color: '#7c3aed',
  footer_text: '© 2025 Falak Academy. All rights reserved.',
  support_email: 'support@falakacademy.com',
  terms_url: null,
  privacy_url: null,
  allow_public_registration: true,
  require_email_verification: false,
  enable_certificates: true,
  enable_quizzes: true,
  maintenance_mode: false
};

const PlatformSettingsContext = createContext<PlatformSettingsContextType | undefined>(undefined);

export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const getAssetUrl = (path: string | null): string | null => {
    if (!path) return null;
    
    // If it's already a full URL, return as is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    
    // Get public URL from Supabase storage
    const { data } = supabase.storage
      .from('platform-assets')
      .getPublicUrl(path);
    
    return data.publicUrl;
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value');

      if (error) {
        console.error('Error loading platform settings:', error);
        return;
      }

      const settingsMap: Record<string, any> = {};
      data?.forEach(setting => {
        try {
          settingsMap[setting.setting_key] = JSON.parse(setting.setting_value);
        } catch {
          settingsMap[setting.setting_key] = setting.setting_value;
        }
      });

      setSettings(prev => ({
        ...prev,
        ...settingsMap
      }));
    } catch (error) {
      console.error('Error loading platform settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

  useEffect(() => {
    loadSettings();

    // Subscribe to settings changes
    const subscription = supabase
      .channel('admin_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_settings'
        },
        () => {
          loadSettings();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Apply custom CSS variables for theming
  useEffect(() => {
    if (!loading) {
      const root = document.documentElement;
      root.style.setProperty('--primary-color', settings.primary_color);
      root.style.setProperty('--secondary-color', settings.secondary_color);
      
      // Update document title
      document.title = settings.site_name;
      
      // Update favicon if provided
      const faviconUrl = getAssetUrl(settings.site_favicon_url);
      if (faviconUrl) {
        let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        favicon.href = faviconUrl;
      }
    }
  }, [settings, loading]);

  const value = {
    settings,
    loading,
    refreshSettings,
    getAssetUrl
  };

  return (
    <PlatformSettingsContext.Provider value={value}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}

export function usePlatformSettings() {
  const context = useContext(PlatformSettingsContext);
  if (context === undefined) {
    throw new Error('usePlatformSettings must be used within a PlatformSettingsProvider');
  }
  return context;
}