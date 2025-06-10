import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { XCircle, ArrowLeft, CreditCard } from 'lucide-react';

export default function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('course_id');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        {/* Cancel Icon */}
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-gray-600 dark:text-gray-400" />
        </div>

        {/* Cancel Message */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Payment Cancelled
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Your payment was cancelled. No charges were made to your account.
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          {courseId && (
            <Link
              to={`/available-courses`}
              className="inline-flex items-center w-full justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Try Payment Again
            </Link>
          )}
          
          <Link
            to="/available-courses"
            className="inline-flex items-center w-full justify-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Browse Courses
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need help? Contact our support team for assistance with your purchase.
          </p>
        </div>
      </div>
    </div>
  );
}