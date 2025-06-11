import React from 'react';
import { X, FileText, Shield, Users, AlertTriangle, Scale, Eye, Lock, Globe, Mail } from 'lucide-react';
import { usePlatformSettings } from '../hooks/usePlatformSettings';

interface TermsOfServiceProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TermsOfService({ isOpen, onClose }: TermsOfServiceProps) {
  const { settings } = usePlatformSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Terms of Service</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-0">
                <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Scale className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              1. Acceptance of Terms
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              By accessing and using {settings.site_name}, you accept and agree to be bound by the terms and provision of this agreement. 
              If you do not agree to abide by the above, please do not use this service.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              2. User Accounts
            </h3>
            <div className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed space-y-3">
              <p>When you create an account with us, you must provide information that is accurate, complete, and current at all times.</p>
              <p>You are responsible for safeguarding the password and for all activities that occur under your account.</p>
              <p>You agree not to disclose your password to any third party and to take sole responsibility for activities under your account.</p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
              3. Course Content and Access
            </h3>
            <div className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed space-y-3">
              <p>Our courses and content are provided for educational purposes only.</p>
              <p>You may not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, download, store, or transmit any of the material on our platform.</p>
              <p>Course access is granted for personal, non-commercial use only unless otherwise specified.</p>
              <p>We reserve the right to modify or discontinue courses at any time without prior notice.</p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" />
              4. Prohibited Uses
            </h3>
            <div className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              <p className="mb-3">You may not use our service:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>For any unlawful purpose or to solicit others to perform unlawful acts</li>
                <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances</li>
                <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others</li>
                <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate</li>
                <li>To submit false or misleading information</li>
                <li>To upload or transmit viruses or any other type of malicious code</li>
              </ul>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Globe className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
              5. Intellectual Property Rights
            </h3>
            <div className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed space-y-3">
              <p>The service and its original content, features, and functionality are and will remain the exclusive property of {settings.site_name} and its licensors.</p>
              <p>The service is protected by copyright, trademark, and other laws.</p>
              <p>Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.</p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-red-600 dark:text-red-400" />
              6. Disclaimer
            </h3>
            <div className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed space-y-3">
              <p>The information on this platform is provided on an "as is" basis. To the fullest extent permitted by law, this Company:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Excludes all representations and warranties relating to this website and its contents</li>
                <li>Excludes all liability for damages arising out of or in connection with your use of this website</li>
              </ul>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Lock className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
              7. Privacy Policy
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the service, 
              to understand our practices.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Scale className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              8. Changes to Terms
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. 
              If a revision is material, we will try to provide at least 30 days notice prior to any new terms taking effect.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Mail className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              9. Contact Information
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at{' '}
              <a 
                href={`mailto:${settings.support_email}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {settings.support_email}
              </a>
            </p>

            <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                By using {settings.site_name}, you acknowledge that you have read and understood these terms and agree to be bound by them.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}