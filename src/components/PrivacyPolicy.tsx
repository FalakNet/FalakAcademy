import React from 'react';
import { X, Shield, Eye, Lock, Database, Users, Globe, Mail, AlertTriangle, FileText } from 'lucide-react';
import { usePlatformSettings } from '../hooks/usePlatformSettings';

interface PrivacyPolicyProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PrivacyPolicy({ isOpen, onClose }: PrivacyPolicyProps) {
  const { settings } = usePlatformSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-3">
              <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Privacy Policy</h2>
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
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200 mb-0">
                <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Eye className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              1. Information We Collect
            </h3>
            <div className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed space-y-3">
              <p><strong>Personal Information:</strong> When you create an account, we collect your name, email address, and other information you provide.</p>
              <p><strong>Usage Data:</strong> We collect information about how you use our platform, including courses accessed, progress, and completion status.</p>
              <p><strong>Technical Data:</strong> We automatically collect certain technical information, including IP address, browser type, device information, and usage patterns.</p>
              <p><strong>Cookies:</strong> We use cookies and similar technologies to enhance your experience and analyze platform usage.</p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Database className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
              2. How We Use Your Information
            </h3>
            <div className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              <p className="mb-3">We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide, maintain, and improve our educational services</li>
                <li>Process your enrollment in courses and track your progress</li>
                <li>Generate certificates and track achievements</li>
                <li>Communicate with you about your account and our services</li>
                <li>Provide customer support and respond to your inquiries</li>
                <li>Analyze usage patterns to improve our platform</li>
                <li>Ensure platform security and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" />
              3. Information Sharing
            </h3>
            <div className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed space-y-3">
              <p>We do not sell, trade, or otherwise transfer your personal information to third parties except as described below:</p>
              <p><strong>Service Providers:</strong> We may share information with trusted third-party service providers who assist us in operating our platform.</p>
              <p><strong>Legal Requirements:</strong> We may disclose information when required by law or to protect our rights, property, or safety.</p>
              <p><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, user information may be transferred.</p>
              <p><strong>Consent:</strong> We may share information with your explicit consent for specific purposes.</p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Lock className="w-5 h-5 mr-2 text-red-600 dark:text-red-400" />
              4. Data Security
            </h3>
            <div className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed space-y-3">
              <p>We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
              <p>These measures include encryption, secure servers, access controls, and regular security assessments.</p>
              <p>However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.</p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
              5. Your Rights and Choices
            </h3>
            <div className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              <p className="mb-3">You have the following rights regarding your personal information:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Access:</strong> Request access to your personal information</li>
                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                <li><strong>Portability:</strong> Request a copy of your data in a portable format</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
                <li><strong>Account Deletion:</strong> Delete your account and associated data</li>
              </ul>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Globe className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              6. Cookies and Tracking
            </h3>
            <div className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed space-y-3">
              <p>We use cookies and similar technologies to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Remember your preferences and settings</li>
                <li>Analyze platform usage and performance</li>
                <li>Provide personalized content and recommendations</li>
                <li>Ensure platform security</li>
              </ul>
              <p>You can control cookie settings through your browser preferences, though some features may not function properly if cookies are disabled.</p>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
              7. Children's Privacy
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. 
              If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Globe className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              8. International Data Transfers
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              Your information may be transferred to and processed in countries other than your own. 
              We ensure appropriate safeguards are in place to protect your information in accordance with this privacy policy.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" />
              9. Data Retention
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              We retain your personal information for as long as necessary to provide our services, comply with legal obligations, 
              resolve disputes, and enforce our agreements. When you delete your account, we will delete or anonymize your personal information, 
              except where retention is required by law.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
              10. Changes to This Policy
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page 
              and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Mail className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              11. Contact Information
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at{' '}
              <a 
                href={`mailto:${settings.support_email}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {settings.support_email}
              </a>
            </p>

            <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                By using {settings.site_name}, you consent to our Privacy Policy and our collection, use, and disclosure practices described herein.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}