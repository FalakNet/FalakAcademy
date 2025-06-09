import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  buttonText?: string;
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  buttonText = 'OK'
}: AlertModalProps) {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle,
          iconBg: 'bg-green-100',
          iconColor: 'text-green-600',
          buttonBg: 'bg-green-600 hover:bg-green-700',
          borderColor: 'border-green-200'
        };
      case 'error':
        return {
          icon: XCircle,
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          buttonBg: 'bg-red-600 hover:bg-red-700',
          borderColor: 'border-red-200'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-yellow-100',
          iconColor: 'text-yellow-600',
          buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
          borderColor: 'border-yellow-200'
        };
      case 'info':
        return {
          icon: Info,
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          buttonBg: 'bg-blue-600 hover:bg-blue-700',
          borderColor: 'border-blue-200'
        };
    }
  };

  const styles = getTypeStyles();
  const IconComponent = styles.icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md transform transition-all">
        <div className="p-6">
          <div className="flex items-start">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${styles.iconBg} flex items-center justify-center mr-4`}>
              <IconComponent className={`w-5 h-5 ${styles.iconColor}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 rounded-b-lg flex justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${styles.buttonBg}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}