import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePlatformSettings } from '../hooks/usePlatformSettings';
import { BookOpen, Eye, EyeOff, ArrowRight, Shield, Users, Award } from 'lucide-react';
import TermsOfService from '../components/TermsOfService';
import PrivacyPolicy from '../components/PrivacyPolicy';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  
  const { user, signIn } = useAuth();
  const { settings, getAssetUrl } = usePlatformSettings();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
    } catch (error: any) {
      setError(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const logoUrl = getAssetUrl(settings.site_logo_url);
  const splashImageUrl = getAssetUrl(settings.login_splash_image_url);

  // Render logo with color based on theme
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const logoColor = isDark ? '#fff' : '#2563eb';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex">
      {/* Left Side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700" />
        <div className="absolute inset-0 bg-black bg-opacity-20" />
        
        {/* Background Image Overlay */}
        {splashImageUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
            style={{ backgroundImage: `url(${splashImageUrl})` }}
          />
        )}
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 py-16 text-white">
          {/* Logo & Brand */}
          <div className="mb-12">
            <div className="flex items-center mb-6">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={settings.site_name}
                  className="w-12 h-12 object-contain mr-4"
                  style={{ filter: isDark ? undefined : 'invert(17%) sepia(92%) saturate(7476%) hue-rotate(210deg) brightness(95%) contrast(101%)' }}
                />
              ) : (
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mr-4">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold">{settings.site_name}</h1>
                <p className="text-white/80 text-sm">{settings.site_description}</p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-6">Transform Your Learning Journey</h2>
              <p className="text-white/90 text-lg leading-relaxed">
                Access comprehensive courses, track your progress, and earn certificates 
                in our modern learning management system.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Interactive Courses</h3>
                  <p className="text-white/80">Engage with multimedia content, quizzes, and hands-on exercises.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Expert Instructors</h3>
                  <p className="text-white/80">Learn from industry professionals and subject matter experts.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Earn Certificates</h3>
                  <p className="text-white/80">Get recognized for your achievements with professional certificates.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="grid grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold">1000+</div>
                <div className="text-white/80 text-sm">Students</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">50+</div>
                <div className="text-white/80 text-sm">Courses</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">95%</div>
                <div className="text-white/80 text-sm">Success Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={settings.site_name}
                  className="w-12 h-12 object-contain mr-3"
                  style={{ filter: isDark ? undefined : 'invert(17%) sepia(92%) saturate(7476%) hue-rotate(210deg) brightness(95%) contrast(101%)' }}
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mr-3">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
              )}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{settings.site_name}</h1>
            </div>
          </div>

          {/* Form Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome back
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Sign in to continue your learning journey
            </p>
          </div>

          {/* Login Form */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white font-medium bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                style={{ 
                  background: loading ? undefined : `linear-gradient(to right, ${settings.primary_color}, ${settings.secondary_color})`
                }}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>

              {settings.allow_public_registration && (
                <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Don't have an account?{' '}
                    <Link 
                      to="/signup" 
                      className="font-medium hover:underline transition-colors"
                      style={{ color: settings.primary_color }}
                    >
                      Create one now
                    </Link>
                  </p>
                </div>
              )}
            </form>
          </div>

          {/* Footer Links */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {settings.footer_text}
            </p>
            <div className="flex justify-center space-x-6">
              <button
                onClick={() => setShowTermsModal(true)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline transition-colors"
              >
                Terms of Service
              </button>
              <button
                onClick={() => setShowPrivacyModal(true)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline transition-colors"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Terms of Service Modal */}
      <TermsOfService 
        isOpen={showTermsModal} 
        onClose={() => setShowTermsModal(false)} 
      />

      {/* Privacy Policy Modal */}
      <PrivacyPolicy 
        isOpen={showPrivacyModal} 
        onClose={() => setShowPrivacyModal(false)} 
      />
    </div>
  );
}