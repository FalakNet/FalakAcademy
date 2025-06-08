import { useState } from 'react';
import { useSettings, Theme, ColorBlindType } from '../hooks/useSettings';
import { 
  X, Sun, Moon, Eye, Type, Contrast, Zap, 
  Palette, Accessibility, Monitor
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
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
  } = useSettings();

  const [activeTab, setActiveTab] = useState<'appearance' | 'accessibility'>('appearance');

  if (!isOpen) return null;

  const handleThemeChange = (newTheme: Theme) => {
    console.log('Theme button clicked:', newTheme);
    setTheme(newTheme);
  };

  const colorBlindOptions = [
    { value: 'none' as ColorBlindType, label: 'None', description: 'Normal color vision' },
    { value: 'protanopia' as ColorBlindType, label: 'Protanopia', description: 'Red-blind' },
    { value: 'deuteranopia' as ColorBlindType, label: 'Deuteranopia', description: 'Green-blind' },
    { value: 'tritanopia' as ColorBlindType, label: 'Tritanopia', description: 'Blue-blind' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'appearance'
                ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Palette className="w-4 h-4" />
              <span>Appearance</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('accessibility')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'accessibility'
                ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Accessibility className="w-4 h-4" />
              <span>Accessibility</span>
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Theme Selection */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Monitor className="w-5 h-5 mr-2" />
                  Theme
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Current theme: <span className="font-medium capitalize">{theme}</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleThemeChange('light')}
                    className={`flex items-center justify-center p-4 rounded-lg border-2 transition-all duration-200 ${
                      theme === 'light'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Sun className="w-6 h-6 mr-2 text-yellow-500" />
                    <span className="font-medium text-gray-900 dark:text-white">Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleThemeChange('dark')}
                    className={`flex items-center justify-center p-4 rounded-lg border-2 transition-all duration-200 ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Moon className="w-6 h-6 mr-2 text-blue-500" />
                    <span className="font-medium text-gray-900 dark:text-white">Dark</span>
                  </button>
                </div>
              </div>

              {/* Font Size */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Type className="w-5 h-5 mr-2" />
                  Font Size
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Size: {fontSize}px</span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        A-
                      </button>
                      <button
                        onClick={() => setFontSize(16)}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => setFontSize(Math.min(24, fontSize + 2))}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        A+
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="24"
                    step="2"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Small</span>
                    <span>Normal</span>
                    <span>Large</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'accessibility' && (
            <div className="space-y-6">
              {/* Color Vision */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  Color Vision Support
                </h3>
                <div className="space-y-2">
                  {colorBlindOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <input
                        type="radio"
                        name="colorBlind"
                        value={option.value}
                        checked={colorBlindType === option.value}
                        onChange={(e) => setColorBlindType(e.target.value as ColorBlindType)}
                        className="mr-3 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{option.label}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* High Contrast */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Contrast className="w-5 h-5 mr-2" />
                  High Contrast
                </h3>
                <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Enable High Contrast</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Increases contrast for better visibility
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={highContrast}
                    onChange={(e) => setHighContrast(e.target.checked)}
                    className="ml-3 text-blue-600 focus:ring-blue-500 rounded"
                  />
                </label>
              </div>

              {/* Reduced Motion */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Zap className="w-5 h-5 mr-2" />
                  Motion
                </h3>
                <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Reduce Motion</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Minimizes animations and transitions
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => setReducedMotion(e.target.checked)}
                    className="ml-3 text-blue-600 focus:ring-blue-500 rounded"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}