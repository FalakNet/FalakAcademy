import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { verifyPaymentStatus } from '../lib/ziina';
import { CheckCircle, BookOpen, Award, ArrowRight, AlertCircle, Clock } from 'lucide-react';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'verifying' | 'success' | 'failed' | 'pending'>('verifying');
  const [course, setCourse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState<string>('');

  const courseId = searchParams.get('course_id');
  const paymentId = searchParams.get('payment_id');

  useEffect(() => {
    if (!courseId || !paymentId || !profile) {
      navigate('/available-courses');
      return;
    }

    verifyPayment();
  }, [courseId, paymentId, profile]);

  const verifyPayment = async () => {
    if (!courseId || !paymentId || !profile) return;

    try {
      setEnrollmentStatus('Loading course details...');
      
      // Load course details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      setEnrollmentStatus('Checking payment status...');

      // Check if payment already exists in our database
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('payment_intent_id', paymentId)
        .single();

      if (existingPayment && existingPayment.status === 'completed') {
        // Payment already processed successfully, check enrollment
        setEnrollmentStatus('Payment confirmed, checking enrollment...');
        await ensureEnrollment(courseData, existingPayment);
        setPaymentStatus('success');
        setLoading(false);
        return;
      }

      setEnrollmentStatus('Verifying payment with payment provider...');

      // Verify payment with Ziina
      const paymentIntent = await verifyPaymentStatus(paymentId);
      
      if (paymentIntent.status === 'completed') {
        setEnrollmentStatus('Payment successful, processing enrollment...');
        // Payment successful - process enrollment and payment record
        await processSuccessfulPayment(courseData, paymentIntent);
        setPaymentStatus('success');
      } else if (paymentIntent.status === 'failed' || paymentIntent.status === 'canceled') {
        setPaymentStatus('failed');
        setError(paymentIntent.latest_error?.message || 'Payment failed');
        
        // Update payment record if it exists
        if (existingPayment) {
          await supabase
            .from('payments')
            .update({
              status: paymentIntent.status === 'canceled' ? 'cancelled' : 'failed',
              error_message: paymentIntent.latest_error?.message || 'Payment failed'
            })
            .eq('id', existingPayment.id);
        }
      } else {
        setPaymentStatus('pending');
      }
    } catch (error) {
      console.error('Payment verification failed:', error);
      setPaymentStatus('failed');
      setError(error instanceof Error ? error.message : 'Payment verification failed');
    } finally {
      setLoading(false);
    }
  };

  const ensureEnrollment = async (courseData: any, paymentRecord: any) => {
    if (!profile) return;

    try {
      // Check if enrollment already exists
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', profile.id)
        .eq('course_id', courseData.id)
        .single();

      if (!existingEnrollment) {
        setEnrollmentStatus('Creating enrollment...');
        
        // Create enrollment
        const { error: enrollmentError } = await supabase
          .from('enrollments')
          .insert({
            user_id: profile.id,
            course_id: courseData.id
          });

        if (enrollmentError) {
          console.error('Error creating enrollment:', enrollmentError);
          throw new Error('Failed to enroll in course. Please contact support.');
        }
        
        setEnrollmentStatus('Enrollment completed successfully!');
      } else {
        setEnrollmentStatus('Already enrolled in course');
      }
    } catch (error) {
      console.error('Error ensuring enrollment:', error);
      throw error;
    }
  };

  const processSuccessfulPayment = async (courseData: any, paymentIntent: any) => {
    if (!profile) return;

    try {
      setEnrollmentStatus('Recording payment...');

      // Check if payment record already exists
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('payment_intent_id', paymentId)
        .single();

      if (!existingPayment) {
        // Create payment record
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            user_id: profile.id,
            course_id: courseData.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency_code,
            payment_intent_id: paymentId,
            status: 'completed',
            completed_at: paymentIntent.completed_at || new Date().toISOString()
          });

        if (paymentError) {
          console.error('Error creating payment record:', paymentError);
          // Don't throw here - payment was successful, just log the error
        }
      } else if (existingPayment.status !== 'completed') {
        // Update existing payment record
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            status: 'completed',
            completed_at: paymentIntent.completed_at || new Date().toISOString(),
            error_message: null
          })
          .eq('id', existingPayment.id);

        if (updateError) {
          console.error('Error updating payment record:', updateError);
        }
      }

      setEnrollmentStatus('Checking enrollment status...');

      // Check if enrollment already exists
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', profile.id)
        .eq('course_id', courseData.id)
        .single();

      if (!existingEnrollment) {
        setEnrollmentStatus('Creating course enrollment...');
        
        // Create enrollment - this is the key part for auto-enrollment
        const { error: enrollmentError } = await supabase
          .from('enrollments')
          .insert({
            user_id: profile.id,
            course_id: courseData.id
          });

        if (enrollmentError) {
          console.error('Error creating enrollment:', enrollmentError);
          throw new Error('Payment successful but failed to enroll in course. Please contact support.');
        }
        
        setEnrollmentStatus('Successfully enrolled in course!');
      } else {
        setEnrollmentStatus('Already enrolled in course');
      }
    } catch (error) {
      console.error('Error processing successful payment:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Processing Payment</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {enrollmentStatus || 'Please wait while we process your payment...'}
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              This may take a few moments. Please don't close this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-2xl text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            🎉 Payment Successful!
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
            Welcome to your new course! You have been automatically enrolled.
          </p>
          
          <p className="text-sm text-green-600 dark:text-green-400 mb-8 font-medium">
            ✅ Enrollment completed - You now have lifetime access to all content
          </p>

          {/* Course Info */}
          {course && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {course.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {course.description}
              </p>
            </div>
          )}

          {/* Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <BookOpen className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
              <h3 className="font-semibold text-green-800 dark:text-green-200 mb-1">Instant Access</h3>
              <p className="text-sm text-green-600 dark:text-green-300">Start learning immediately</p>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">Lifetime Access</h3>
              <p className="text-sm text-blue-600 dark:text-blue-300">Learn at your own pace</p>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <Award className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
              <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-1">Certificate</h3>
              <p className="text-sm text-purple-600 dark:text-purple-300">Earn upon completion</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to={`/courses/${courseId}`}
              className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
            >
              Start Learning
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            
            <Link
              to="/my-courses"
              className="inline-flex items-center px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              View My Courses
            </Link>
          </div>

          {/* Receipt Info */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Payment ID: {paymentId}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              A receipt has been sent to your email address.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (paymentStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Payment Processing</h2>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your payment is being processed. This may take a few minutes.
          </p>

          <button
            onClick={verifyPayment}
            className="w-full bg-yellow-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-yellow-700 transition-colors mb-4"
          >
            Check Status Again
          </button>

          <Link
            to="/my-courses"
            className="block text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Return to My Courses
          </Link>
        </div>
      </div>
    );
  }

  // Payment failed
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Payment Failed</h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          We couldn't process your payment.
        </p>

        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm mb-6">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <Link
            to={`/available-courses`}
            className="block w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Try Again
          </Link>
          
          <Link
            to="/available-courses"
            className="block text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Browse Other Courses
          </Link>
        </div>
      </div>
    </div>
  );
}