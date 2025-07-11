import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePlatformSettings } from '../hooks/usePlatformSettings';
import { BookOpen, Eye, EyeOff, ArrowRight, Shield, Users, Award, CheckCircle, AlertCircle } from 'lucide-react';
import TermsOfService from '../components/TermsOfService';
import PrivacyPolicy from '../components/PrivacyPolicy';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  const { user, signUp } = useAuth();
  const { settings, getAssetUrl } = usePlatformSettings();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // If public registration is disabled, redirect to login
  if (!settings.allow_public_registration) {
    return <Navigate to="/login\" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFormSubmitted(true);

    // Validate terms and privacy acceptance
    if (!termsAccepted || !privacyAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy to continue');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // Store acceptance timestamp in user metadata
      const acceptanceTimestamp = new Date().toISOString();
      
      await signUp(email, password, name);
      
      // Note: In a production environment, you would also want to store the acceptance
      // in your database, possibly in a separate table that logs user consent
      
      // Example of how you might store this if you had direct database access:
      // await supabase.from('user_consents').insert({
      //   user_id: user.id,
      //   terms_accepted_at: acceptanceTimestamp,
      //   privacy_accepted_at: acceptanceTimestamp,
      //   terms_version: '1.0',
      //   privacy_version: '1.0'
      // });
      
    } catch (error: any) {
      setError(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const passwordRequirements = [
    { text: 'At least 6 characters', met: password.length >= 6 },
    { text: 'Passwords match', met: password === confirmPassword && password.length > 0 }
  ];

  // Logo URL and color logic
  function getThemeMode() {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    if (stored === 'dark' || stored === 'light') return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }
  const themeMode = getThemeMode();
  const logoColor = themeMode === 'dark' ? '#fff' : '#2563eb';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex">
      {/* Left Side - Branding & Benefits */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-700" />
        <div className="absolute inset-0 bg-black bg-opacity-20" />
                
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 py-16 text-white">
          {/* Logo & Brand */}
          <div className="mb-12">
            <div className="flex items-center mb-6">
              <img 
                src="/ficon.svg"
                alt={settings.site_name}
                className="w-12 h-12 object-contain mr-4"
              />
              <div>
                <h1 className="text-3xl font-bold">{settings.site_name}</h1>
                <p className="text-white/80 text-sm">{settings.site_description}</p>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-6">Start Your Learning Adventure</h2>
              <p className="text-white/90 text-lg leading-relaxed">
                Join thousands of learners who are advancing their skills and 
                achieving their goals with our comprehensive platform.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Unlimited Access</h3>
                  <p className="text-white/80">Access all courses and learning materials at your own pace.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Progress Tracking</h3>
                  <p className="text-white/80">Monitor your learning journey with detailed analytics and insights.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Professional Certificates</h3>
                  <p className="text-white/80">Earn industry-recognized certificates to showcase your achievements.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Interactive Quizzes</h3>
                  <p className="text-white/80">Test your knowledge and reinforce learning with engaging quizzes throughout your courses.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <img 
                src="/ficon.svg"
                alt={settings.site_name}
                className="w-12 h-12 object-contain mr-3"
                style={{ filter: themeMode === 'dark' ? undefined : 'brightness(0) saturate(100%) invert(59%) sepia(78%) saturate(7488%) hue-rotate(252deg) brightness(95%) contrast(94%)' }}
              />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{settings.site_name}</h1>
            </div>
          </div>

          {/* Form Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Create your account
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Join our learning community today
            </p>
          </div>

          {/* Signup Form */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                  placeholder="Enter your full name"
                />
              </div>

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
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
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
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                    placeholder="Create a password"
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

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors"
                    placeholder="Confirm your password"
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

              {/* Password Requirements */}
              {password && (
                <div className="space-y-2">
                  {passwordRequirements.map((req, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <CheckCircle className={`w-4 h-4 mr-2 ${req.met ? 'text-green-500' : 'text-gray-300'}`} />
                      <span className={req.met ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
                        {req.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Terms and Privacy Checkboxes */}
              <div className="space-y-3">
                <div className={`flex items-start ${formSubmitted && !termsAccepted ? 'animate-pulse' : ''}`}>
                  <div className="flex items-center h-5">
                    <input
                      id="terms"
                      name="terms"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className={`h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded ${
                        formSubmitted && !termsAccepted 
                          ? 'border-red-500 ring-2 ring-red-200' 
                          : ''
                      }`}
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="terms" className={`font-medium ${
                      formSubmitted && !termsAccepted 
                        ? 'text-red-700 dark:text-red-400' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setShowTermsModal(true)}
                        className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                      >
                        Terms of Service
                      </button>
                    </label>
                    {formSubmitted && !termsAccepted && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        You must accept the Terms of Service
                      </p>
                    )}
                  </div>
                </div>

                <div className={`flex items-start ${formSubmitted && !privacyAccepted ? 'animate-pulse' : ''}`}>
                  <div className="flex items-center h-5">
                    <input
                      id="privacy"
                      name="privacy"
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className={`h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded ${
                        formSubmitted && !privacyAccepted 
                          ? 'border-red-500 ring-2 ring-red-200' 
                          : ''
                      }`}
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="privacy" className={`font-medium ${
                      formSubmitted && !privacyAccepted 
                        ? 'text-red-700 dark:text-red-400' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setShowPrivacyModal(true)}
                        className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                      >
                        Privacy Policy
                      </button>
                    </label>
                    {formSubmitted && !privacyAccepted && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        You must accept the Privacy Policy
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white font-medium bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                style={{ 
                  background: loading ? undefined : `linear-gradient(to right, ${settings.secondary_color}, ${settings.primary_color})`
                }}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>

              <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Already have an account?{' '}
                  <Link 
                    to="/login" 
                    className="font-medium hover:underline transition-colors"
                    style={{ color: settings.primary_color }}
                  >
                    Sign in here
                  </Link>
                </p>
              </div>
            </form>
          </div>

          {/* Footer Links */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {settings.footer_text}
            </p>
            {(settings.terms_url || settings.privacy_url) && (
              <div className="flex justify-center space-x-6">
                {settings.terms_url && (
                  <a 
                    href={settings.terms_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline transition-colors"
                  >
                    Terms of Service
                  </a>
                )}
                {settings.privacy_url && (
                  <a 
                    href={settings.privacy_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline transition-colors"
                  >
                    Privacy Policy
                  </a>
                )}
              </div>
            )}
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