import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { 
  Settings, Database, Users, Shield, Mail, Globe, Save, AlertCircle, 
  Upload, Image, Palette, Eye, EyeOff, CheckCircle, X, Monitor,
  FileText, Lock, HelpCircle, Trash2, CreditCard
} from 'lucide-react';
import AlertModal from '../../components/AlertModal';

interface AdminSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  setting_type: string;
  category: string;
  display_name: string;
  description?: string;
}

export default function AdminSettings() {
  const { profile, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [settings, setSettings] = useState<Record<string, AdminSetting>>({});
  const [uploadingAssets, setUploadingAssets] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'branding' | 'general' | 'features' | 'legal' | 'system' | 'payments'>('branding');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    totalEnrollments: 0,
    totalQuizzes: 0,
    totalMaterials: 0
  });

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  useEffect(() => {
    if (isSuperAdmin()) {
      loadSettings();
      loadSystemStats();
    }
  }, [profile]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .order('category, display_name');

      if (error) throw error;

      const settingsMap: Record<string, AdminSetting> = {};
      data?.forEach(setting => {
        settingsMap[setting.setting_key] = setting;
      });

      setSettings(settingsMap);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemStats = async () => {
    try {
      const [users, courses, enrollments, quizzes, materials] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('courses').select('id', { count: 'exact', head: true }),
        supabase.from('enrollments').select('id', { count: 'exact', head: true }),
        supabase.from('quizzes').select('id', { count: 'exact', head: true }),
        supabase.from('materials').select('id', { count: 'exact', head: true })
      ]);

      setStats({
        totalUsers: users.count || 0,
        totalCourses: courses.count || 0,
        totalEnrollments: enrollments.count || 0,
        totalQuizzes: quizzes.count || 0,
        totalMaterials: materials.count || 0
      });
    } catch (error) {
      console.error('Error loading system stats:', error);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    try {
      const setting = settings[key];
      if (!setting) return;

      const { error } = await supabase
        .from('admin_settings')
        .update({ 
          setting_value: JSON.stringify(value),
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', key);

      if (error) throw error;

      setSettings(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          setting_value: value
        }
      }));
    } catch (error) {
      console.error('Error updating setting:', error);
      throw error;
    }
  };

  const handleFileUpload = async (settingKey: string, file: File) => {
    if (!file) return;

    // Validate file type for images
    if (settings[settingKey]?.setting_type === 'image' && !file.type.startsWith('image/')) {
      showAlert('Invalid File', 'Please upload an image file', 'warning');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showAlert('File Too Large', 'File size must be less than 5MB', 'warning');
      return;
    }

    setUploadingAssets(prev => new Set([...prev, settingKey]));
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${settingKey}_${Date.now()}.${fileExt}`;

      // Upload to platform-assets bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('platform-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('platform-assets')
        .getPublicUrl(uploadData.path);

      // Update setting with new URL
      await updateSetting(settingKey, urlData.publicUrl);

    } catch (error) {
      console.error('Error uploading file:', error);
      showAlert('Upload Failed', 'Failed to upload file', 'error');
    } finally {
      setUploadingAssets(prev => {
        const newSet = new Set(prev);
        newSet.delete(settingKey);
        return newSet;
      });
    }
  };

  const removeAsset = async (settingKey: string) => {
    if (!confirm('Are you sure you want to remove this asset?')) return;

    try {
      const currentUrl = settings[settingKey]?.setting_value;
      if (currentUrl && typeof currentUrl === 'string') {
        // Extract file path from URL
        const urlParts = currentUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        // Delete from storage
        await supabase.storage
          .from('platform-assets')
          .remove([fileName]);
      }

      // Update setting to null
      await updateSetting(settingKey, null);
    } catch (error) {
      console.error('Error removing asset:', error);
      showAlert('Remove Failed', 'Failed to remove asset', 'error');
    }
  };

  const saveAllSettings = async () => {
    setSaveStatus('saving');
    
    try {
      // All settings are saved individually, so this is just a status update
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const exportData = async (table: string) => {
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${table}_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error exporting ${table}:`, error);
      showAlert('Export Failed', `Failed to export ${table} data`, 'error');
    }
  };

  const renderSettingInput = (setting: AdminSetting) => {
    const value = setting.setting_value;
    const isUploading = uploadingAssets.has(setting.setting_key);

    switch (setting.setting_type) {
      case 'text':
      case 'email':
      case 'url':
        return (
          <input
            type={setting.setting_type === 'email' ? 'email' : setting.setting_type === 'url' ? 'url' : 'text'}
            value={value || ''}
            onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder={setting.description}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || 0}
            onChange={(e) => updateSetting(setting.setting_key, parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            min="0"
          />
        );

      case 'boolean':
        return (
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => updateSetting(setting.setting_key, e.target.checked)}
              className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">
              {value ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        );

      case 'color':
        return (
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={value || '#2563eb'}
              onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={value || '#2563eb'}
              onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="#2563eb"
            />
          </div>
        );

      case 'select':
        if (setting.setting_key === 'default_user_role') {
          return (
            <select
              value={value || 'USER'}
              onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="USER">User</option>
              <option value="COURSE_ADMIN">Course Admin</option>
            </select>
          );
        }
        return null;

      case 'image':
        return (
          <div className="space-y-3">
            {value && (
              <div className="relative inline-block">
                <img
                  src={value}
                  alt={setting.display_name}
                  className="max-w-xs max-h-32 rounded-lg border border-gray-200"
                />
                <button
                  onClick={() => removeAsset(setting.setting_key)}
                  className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            
            <div className="flex items-center space-x-3">
              <input
                ref={(el) => fileInputRefs.current[setting.setting_key] = el}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(setting.setting_key, file);
                }}
                className="hidden"
              />
              <button
                onClick={() => fileInputRefs.current[setting.setting_key]?.click()}
                disabled={isUploading}
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {value ? 'Replace' : 'Upload'}
                  </>
                )}
              </button>
              {value && (
                <button
                  onClick={() => removeAsset(setting.setting_key)}
                  className="inline-flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </button>
              )}
            </div>
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => updateSetting(setting.setting_key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        );
    }
  };

  const getSettingsByCategory = (category: string) => {
    return Object.values(settings).filter(setting => setting.category === category);
  };

  if (!isSuperAdmin()) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You need superadmin privileges to access system settings.</p>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, title, value, color }: { 
    icon: any, 
    title: string, 
    value: number, 
    color: string 
  }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'branding', name: 'Branding', icon: Palette },
    { id: 'general', name: 'General', icon: Settings },
    { id: 'features', name: 'Features', icon: Monitor },
    { id: 'payments', name: 'Payments', icon: CreditCard },
    { id: 'legal', name: 'Legal', icon: FileText },
    { id: 'system', name: 'System', icon: Database }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Settings</h1>
          <p className="mt-2 text-gray-600">Configure your learning platform's appearance and functionality.</p>
        </div>
        <button
          onClick={saveAllSettings}
          disabled={saveStatus === 'saving'}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save All'}
        </button>
      </div>

      {/* System Statistics */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={Users}
            title="Total Users"
            value={stats.totalUsers}
            color="bg-blue-500"
          />
          <StatCard
            icon={Database}
            title="Total Courses"
            value={stats.totalCourses}
            color="bg-emerald-500"
          />
          <StatCard
            icon={Users}
            title="Enrollments"
            value={stats.totalEnrollments}
            color="bg-orange-500"
          />
          <StatCard
            icon={Settings}
            title="Quizzes"
            value={stats.totalQuizzes}
            color="bg-purple-500"
          />
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {getSettingsByCategory(activeTab).map((setting) => (
                <div key={setting.setting_key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        {setting.display_name}
                      </label>
                      {setting.description && (
                        <p className="text-xs text-gray-500 mt-1">{setting.description}</p>
                      )}
                    </div>
                  </div>
                  {renderSettingInput(setting)}
                </div>
              ))}

              {/* Payments Tab Additional Content */}
              {activeTab === 'payments' && (
                <div className="border-t border-gray-200 pt-6 mt-8">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <CreditCard className="w-5 h-5 text-blue-600 mt-0.5 mr-2" />
                      <div>
                        <h4 className="text-sm font-medium text-blue-800">Ziina Payment Gateway</h4>
                        <p className="text-sm text-blue-600 mt-1">
                          Configure payment settings for course purchases. Test mode allows you to test payments without real charges.
                        </p>
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-blue-600">
                            <strong>Test Mode:</strong> Use any card number (e.g., 4242424242424242), any future expiry date, and any CVV.
                          </p>
                          <p className="text-xs text-blue-600">
                            <strong>Production Mode:</strong> Real payments will be processed using actual payment methods.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* System Tab Additional Content */}
              {activeTab === 'system' && (
                <div className="border-t border-gray-200 pt-6 mt-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Data Management</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Export Data</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => exportData('profiles')}
                          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          Users
                        </button>
                        <button
                          onClick={() => exportData('courses')}
                          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          Courses
                        </button>
                        <button
                          onClick={() => exportData('enrollments')}
                          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          Enrollments
                        </button>
                        <button
                          onClick={() => exportData('certificates')}
                          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          Certificates
                        </button>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex items-start space-x-2">
                        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Database Backup</p>
                          <p className="text-xs text-gray-500">
                            Regular backups are automatically handled by Supabase. 
                            Contact support for manual backup requests.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Status */}
      {saveStatus === 'saved' && (
        <div className="fixed bottom-4 right-4 bg-green-100 border border-green-200 text-green-800 px-4 py-2 rounded-lg shadow-lg flex items-center">
          <CheckCircle className="w-4 h-4 mr-2" />
          Settings saved successfully!
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-200 text-red-800 px-4 py-2 rounded-lg shadow-lg flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          Failed to save settings!
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}