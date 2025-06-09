import { ReactNode, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePlatformSettings } from '../hooks/usePlatformSettings';
import { 
  BookOpen, 
  Users, 
  Settings, 
  LogOut, 
  Home,
  FileText,
  Brain,
  Award,
  Shield,
  Crown,
  Menu,
  X
} from 'lucide-react';
import SettingsModal from './SettingsModal';

interface LayoutProps {
  children?: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut, isAdmin, isSuperAdmin } = useAuth();
  const { settings, getAssetUrl } = usePlatformSettings();
  const location = useLocation();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Different navigation items based on user role
  const getNavItems = () => {
    if (isSuperAdmin()) {
      // Superadmin gets only admin navigation - no course enrollment features
      return [
        { path: '/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/admin/users', icon: Users, label: 'User Management' },
        { path: '/admin/courses', icon: BookOpen, label: 'Course Management' },
        { path: '/admin/quizzes', icon: Brain, label: 'Quizzes' },
        { path: '/admin/settings', icon: Settings, label: 'System Settings' }
      ];
    } else if (isAdmin()) {
      // Course admins get admin navigation only - no student features
      return [
        { path: '/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/admin/courses', icon: BookOpen, label: 'Course Management' },
        { path: '/admin/quizzes', icon: Brain, label: 'Quizzes' }
      ];
    } else {
      // Regular users get standard student navigation
      return [
        { path: '/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/my-courses', icon: BookOpen, label: 'My Courses' },
        { path: '/available-courses', icon: FileText, label: 'Available Courses' },
        { path: '/certificates', icon: Award, label: 'Certificates' }
      ];
    }
  };

  const navItems = getNavItems();

  const getRoleIcon = () => {
    if (isSuperAdmin()) {
      return <Crown className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    } else if (isAdmin()) {
      return <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    } else {
      return <BookOpen className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getRoleColor = () => {
    if (isSuperAdmin()) {
      return 'text-purple-600 dark:text-purple-400';
    } else if (isAdmin()) {
      return 'text-blue-600 dark:text-blue-400';
    } else {
      return 'text-gray-600 dark:text-gray-400';
    }
  };

  const closeSidebar = () => setSidebarOpen(false);

  const logoUrl = getAssetUrl(settings.site_logo_url);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header - Hide logo on mobile */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="hidden lg:flex items-center">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={settings.site_name}
                  className="w-8 h-8 mr-3 object-contain"
                />
              ) : (
                <BookOpen className="w-8 h-8 text-blue-600 mr-3" />
              )}
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{settings.site_name}</h1>
            </div>
            <button
              onClick={closeSidebar}
              className="lg:hidden text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white ml-auto"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeSidebar}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    active
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-3 flex-shrink-0 ${
                    active 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User info and actions */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {profile?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{profile?.name}</p>
                {/* Hide role icon on mobile */}
                <div className="hidden lg:flex items-center">
                  {getRoleIcon()}
                  <p className={`text-xs ml-1 capitalize truncate ${getRoleColor()}`}>
                    {profile?.role.toLowerCase().replace('_', ' ')}
                  </p>
                </div>
                {/* Show role text only on mobile */}
                <p className={`lg:hidden text-xs capitalize truncate ${getRoleColor()}`}>
                  {profile?.role.toLowerCase().replace('_', ' ')}
                </p>
              </div>
            </div>

            {/* Settings and Logout */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowSettingsModal(true);
                  closeSidebar();
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Settings className="w-4 h-4 mr-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <span>Settings</span>
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <LogOut className="w-4 h-4 mr-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={settings.site_name}
                  className="w-6 h-6 mr-2 object-contain"
                />
              ) : (
                <BookOpen className="w-6 h-6 text-blue-600 mr-2" />
              )}
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">{settings.site_name}</h1>
            </div>
            <div className="w-6 h-6" /> {/* Spacer for centering */}
          </div>
        </div>

        <main className="p-4 sm:p-6 lg:p-8">
          {children || <Outlet />}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />
    </div>
  );
}