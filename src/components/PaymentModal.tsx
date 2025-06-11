import React, { useState, useRef } from 'react';
import { X, CreditCard, Shield, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Course } from '../lib/supabase';
import { createPaymentIntent, formatCurrency, getSupportedCurrencies, verifyPaymentStatus } from '../lib/ziina';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  onPaymentSuccess: () => void;
}

export default function PaymentModal({ isOpen, onClose, course, onPaymentSuccess }: PaymentModalProps) {
  const { profile } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [paymentTab, setPaymentTab] = useState<Window | null>(null);
  const [monitoringInterval, setMonitoringInterval] = useState<NodeJS.Timeout | null>(null);

  if (!isOpen || !course.price || !course.currency) return null;

  const handlePayment = async () => {
    if (!profile) {
      setError('You must be logged in to make a purchase');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const baseUrl = window.location.origin;
      
      // Create payment intent with Ziina (always in test mode)
      const paymentIntent = await createPaymentIntent({
        amount: course.price,
        currency: course.currency,
        success_url: `${baseUrl}/payment/success?course_id=${course.id}&payment_id={PAYMENT_INTENT_ID}`,
        cancel_url: `${baseUrl}/payment/cancel?course_id=${course.id}&payment_id={PAYMENT_INTENT_ID}`,
      });

      // Create payment record in our database
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: profile.id,
          course_id: course.id,
          amount: course.price,
          currency: course.currency,
          payment_intent_id: paymentIntent.id,
          status: 'pending'
        });

      if (paymentError) {
        console.error('Error creating payment record:', paymentError);
      }

      // Open payment page in new tab
      const newTab = window.open(paymentIntent.redirect_url, '_blank');
      setPaymentTab(newTab);
      
      if (newTab) {
        setMonitoring(true);
        startPaymentMonitoring(paymentIntent.id, newTab);
      } else {
        throw new Error('Failed to open payment window. Please allow popups for this site.');
      }

    } catch (error) {
      console.error('Payment creation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to create payment');
    } finally {
      setProcessing(false);
    }
  };

  const startPaymentMonitoring = (paymentIntentId: string, tab: Window) => {
    const interval = setInterval(async () => {
      try {
        // Check if tab is closed
        if (tab.closed) {
          stopMonitoring();
          return;
        }

        // Check payment status directly with Ziina
        const paymentStatus = await verifyPaymentStatus(paymentIntentId);
        
        if (paymentStatus.status === 'completed') {
          // Payment successful - enroll user and close tab
          await handlePaymentSuccess(tab, paymentStatus);
          stopMonitoring();
        } else if (paymentStatus.status === 'failed' || paymentStatus.status === 'canceled') {
          // Payment failed - close tab and show error
          tab.close();
          setError('Payment was not completed. Please try again.');
          stopMonitoring();
        }
      } catch (error) {
        console.error('Error monitoring payment:', error);
        // Continue monitoring - might be a temporary network issue
      }
    }, 2000); // Check every 2 seconds

    setMonitoringInterval(interval);

    // Stop monitoring after 10 minutes
    setTimeout(() => {
      if (interval) {
        stopMonitoring();
        if (!tab.closed) {
          tab.close();
        }
        setError('Payment monitoring timed out. Please check your payment status.');
      }
    }, 10 * 60 * 1000);
  };

  const handlePaymentSuccess = async (tab: Window, paymentStatus: any) => {
    try {
      // Update payment record in our database
      await supabase
        .from('payments')
        .update({
          status: 'completed',
          completed_at: paymentStatus.completed_at || new Date().toISOString()
        })
        .eq('payment_intent_id', paymentStatus.id);

      // Enroll user in the course
      const { error: enrollmentError } = await supabase
        .from('enrollments')
        .insert({
          user_id: profile!.id,
          course_id: course.id
        });

      if (enrollmentError && !enrollmentError.message.includes('duplicate')) {
        console.error('Error enrolling user:', enrollmentError);
        setError('Payment successful but enrollment failed. Please contact support.');
        return;
      }

      // Close the payment tab
      tab.close();
      
      // Call success callback
      onPaymentSuccess();
      
      // Close this modal
      onClose();
      
    } catch (error) {
      console.error('Error handling payment success:', error);
      setError('Payment successful but enrollment failed. Please contact support.');
    }
  };

  const stopMonitoring = () => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      setMonitoringInterval(null);
    }
    setMonitoring(false);
    setPaymentTab(null);
  };

  const handleClose = () => {
    if (paymentTab && !paymentTab.closed) {
      paymentTab.close();
    }
    stopMonitoring();
    onClose();
  };

  const currencyInfo = getSupportedCurrencies().find(c => c.code === course.currency);
  const formattedPrice = formatCurrency(course.price, course.currency);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md transform transition-all">
        {/* Header */}
        <div className="relative p-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-4">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Complete Purchase</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Secure payment powered by Ziina</p>
            </div>
          </div>
        </div>

        {/* Course Info */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{course.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {course.description || 'Premium course content with lifetime access'}
            </p>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Course Price</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formattedPrice}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Currency</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {currencyInfo?.name} ({currencyInfo?.symbol})
              </span>
            </div>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{formattedPrice}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Features */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <Shield className="w-4 h-4 text-green-500 mr-2" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Secure Payment</span>
            </div>
            <div className="flex items-center">
              <Clock className="w-4 h-4 text-blue-500 mr-2" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Instant Access</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="w-4 h-4 text-purple-500 mr-2" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Lifetime Access</span>
            </div>
            <div className="flex items-center">
              <CreditCard className="w-4 h-4 text-orange-500 mr-2" />
              <span className="text-xs text-gray-600 dark:text-gray-400">All Cards</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Monitoring Status */}
        {monitoring && (
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Processing payment... Complete your payment in the new tab.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Button */}
        <div className="p-6">
          <button
            onClick={handlePayment}
            disabled={processing || monitoring}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating Payment...
              </>
            ) : monitoring ? (
              <>
                <div className="animate-pulse w-5 h-5 bg-white rounded-full mr-2"></div>
                Processing Payment...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Pay {formattedPrice}
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
            Payment will open in a new tab. Keep this window open to complete enrollment.
          </p>
        </div>
      </div>
    </div>
  );
}