import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('course_id');
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-2xl text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          🎉 Payment Successful!
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
          Welcome to your new course! You have been automatically enrolled.
        </p>
        <p className="text-sm text-green-600 dark:text-green-400 mb-8 font-medium">
          ✅ Enrollment completed - You now have lifetime access to all content
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {courseId && (
            <Link
              to={`/courses/${courseId}`}
              className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
            >
              Start Learning
            </Link>
          )}
          <Link
            to="/my-courses"
            className="inline-flex items-center px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            View My Courses
          </Link>
        </div>
      </div>
    </div>
  );
}