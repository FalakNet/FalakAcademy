import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Settings, Database, Users, Shield, Mail, Globe, Save, AlertCircle } from 'lucide-react';

export default function AdminSettings() {
  const { profile, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    totalEnrollments: 0,
    totalQuizzes: 0,
    totalMaterials: 0
  });

  const [systemSettings, setSystemSettings] = useState({
    siteName: 'Falak Academy',
    siteDescription: 'Professional Learning Management System',
    allowPublicRegistration: true,
    requireEmailVerification: false,
    defaultUserRole: 'USER',
    maxFileUploadSize: 50, // MB
    enableCertificates: true,
    enableQuizzes: true,
    maintenanceMode: false
  });

  useEffect(() => {
    if (isSuperAdmin()) {
      loadSystemStats();
    }
  }, [profile]);

  const loadSystemStats = async () => {
    try {
      setLoading(true);
      
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
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaveStatus('saving');
    
    // Simulate saving settings (in a real app, you'd save to a settings table)
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);
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
      alert(`Failed to export ${table} data`);
    }
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="mt-2 text-gray-600">Manage system configuration and monitor platform statistics.</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saveStatus === 'saving'}
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* System Statistics */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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
          <StatCard
            icon={Database}
            title="Materials"
            value={stats.totalMaterials}
            color="bg-pink-500"
          />
        </div>
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* General Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            General Settings
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
              <input
                type="text"
                value={systemSettings.siteName}
                onChange={(e) => setSystemSettings({ ...systemSettings, siteName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site Description</label>
              <textarea
                value={systemSettings.siteDescription}
                onChange={(e) => setSystemSettings({ ...systemSettings, siteDescription: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max File Upload Size (MB)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={systemSettings.maxFileUploadSize}
                onChange={(e) => setSystemSettings({ ...systemSettings, maxFileUploadSize: parseInt(e.target.value) || 50 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* User Management Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            User Management
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Allow Public Registration</label>
                <p className="text-xs text-gray-500">Allow users to sign up without invitation</p>
              </div>
              <input
                type="checkbox"
                checked={systemSettings.allowPublicRegistration}
                onChange={(e) => setSystemSettings({ ...systemSettings, allowPublicRegistration: e.target.checked })}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Require Email Verification</label>
                <p className="text-xs text-gray-500">Users must verify email before accessing</p>
              </div>
              <input
                type="checkbox"
                checked={systemSettings.requireEmailVerification}
                onChange={(e) => setSystemSettings({ ...systemSettings, requireEmailVerification: e.target.checked })}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default User Role</label>
              <select
                value={systemSettings.defaultUserRole}
                onChange={(e) => setSystemSettings({ ...systemSettings, defaultUserRole: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="USER">User</option>
                <option value="COURSE_ADMIN">Course Admin</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feature Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Feature Settings
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Enable Certificates</label>
                <p className="text-xs text-gray-500">Allow automatic certificate generation</p>
              </div>
              <input
                type="checkbox"
                checked={systemSettings.enableCertificates}
                onChange={(e) => setSystemSettings({ ...systemSettings, enableCertificates: e.target.checked })}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Enable Quizzes</label>
                <p className="text-xs text-gray-500">Allow quiz creation and taking</p>
              </div>
              <input
                type="checkbox"
                checked={systemSettings.enableQuizzes}
                onChange={(e) => setSystemSettings({ ...systemSettings, enableQuizzes: e.target.checked })}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Maintenance Mode</label>
                <p className="text-xs text-gray-500">Temporarily disable public access</p>
              </div>
              <input
                type="checkbox"
                checked={systemSettings.maintenanceMode}
                onChange={(e) => setSystemSettings({ ...systemSettings, maintenanceMode: e.target.checked })}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2" />
            Data Management
          </h3>
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
      </div>

      {/* Save Status */}
      {saveStatus === 'saved' && (
        <div className="fixed bottom-4 right-4 bg-green-100 border border-green-200 text-green-800 px-4 py-2 rounded-lg shadow-lg">
          Settings saved successfully!
        </div>
      )}
    </div>
  );
}