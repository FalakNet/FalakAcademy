import React, { useState } from 'react';
import { Eye, EyeOff, Key, Copy, CheckCircle } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  password: string;
  userName: string;
}

export default function PasswordModal({
  isOpen,
  onClose,
  password,
  userName
}: PasswordModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy password:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md transform transition-all">
        <div className="p-6">
          <div className="flex items-start mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-4">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                User Created Successfully
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Account for <strong>{userName}</strong> has been created with a temporary password.
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <div className="flex items-center mb-2">
              <Key className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-2" />
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Temporary Password
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 font-mono text-sm">
                {showPassword ? password : '••••••••••••'}
              </div>
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={copyToClipboard}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Copy password"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Important:</strong> Please share this password securely with the user. 
              They should change it upon first login for security.
            </p>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 rounded-b-lg flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}