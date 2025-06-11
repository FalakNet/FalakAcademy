import React, { useState, useEffect } from 'react';
import { X, CreditCard, Shield, Clock, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
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
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [monitoring, setMonitoring] = useState(false);
  const [monitoringInterval, setMonitoringInterval] = useState<NodeJS.Timeout | null>(null);
  const [paymentTab, setPaymentTab] = useState<Window | null>(null);

  // Load test mode setting from admin settings
  useEffect(() => {
    const loadTestModeSetting = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'test_mode')
          .single();

        if (error) {
          console.error('Error loading test mode setting:', error);
          // Default to test mode if we can't load the setting
          setTestMode(true);
        } else {
          const isTestMode = JSON.parse(data.setting_value) === true;
          setTestMode(isTestMode);
        }
      } catch (error) {
        console.error('Error parsing test mode setting:', error);
        setTestMode(true);
      } finally {
        setLoadingSettings(false);
      }
    };

    if (isOpen) {
      loadTestModeSetting();
    }
  }, [isOpen]);

  // Clean up monitoring when component unmounts
  useEffect(() => {
    return () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }
    };
  }, [monitoringInterval]);

  if (!isOpen || !course.price || !course.currency) return null;

  const handleCreatePayment = async () => {
    if (!profile) {
      setError('You must be logged in to make a purchase');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const baseUrl = window.location.origin;
      
      console.log('Creating payment with test mode:', testMode);
      
      // Create payment intent with Ziina
      const paymentIntent = await createPaymentIntent({
        amount: course.price,
        currency: course.currency,
        success_url: `${baseUrl}/payment/success?course_id=${course.id}&payment_id={PAYMENT_INTENT_ID}`,
        cancel_url: `${baseUrl}/payment/cancel?course_id=${course.id}&payment_id={PAYMENT_INTENT_ID}`,
        test: testMode,
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

      // Set the payment link and ID for the user to open manually
      setPaymentLink(paymentIntent.redirect_url);
      setPaymentIntentId(paymentIntent.id);

    } catch (error) {
      console.error('Payment creation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to create payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenPayment = () => {
    if (paymentLink) {
      // Open payment in new tab
      const newTab = window.open(paymentLink, '_blank', 'noopener,noreferrer');
      setPaymentTab(newTab);
      
      // Start monitoring payment status
      if (paymentIntentId) {
        setMonitoring(true);
        startPaymentMonitoring(paymentIntentId);
      }
    }
  };

  const startPaymentMonitoring = (paymentIntentId: string) => {
    // Check payment status every 3 seconds
    const interval = setInterval(async () => {
      try {
        // Check if tab is closed
        if (paymentTab && paymentTab.closed) {
          console.log('Payment tab closed, checking final status');
          await checkPaymentStatus(paymentIntentId);
          stopMonitoring();
          return;
        }

        // Check payment status in our database
        const { data: payment, error } = await supabase
          .from('payments')
          .select('status')
          .eq('payment_intent_id', paymentIntentId)
          .single();

        if (error) {
          console.error('Error checking payment status:', error);
          return;
        }

        if (payment?.status === 'completed') {
          // Payment successful - enroll user and close tab
          await handlePaymentSuccess(paymentIntentId);
          stopMonitoring();
        } else if (payment?.status === 'failed' || payment?.status === 'cancelled') {
          // Payment failed - close tab and show error
          if (paymentTab && !paymentTab.closed) {
            paymentTab.close();
          }
          setError('Payment was not completed. Please try again.');
          stopMonitoring();
        }
      } catch (error) {
        console.error('Error monitoring payment:', error);
      }
    }, 3000); // Check every 3 seconds

    setMonitoringInterval(interval);

    // Stop monitoring after 10 minutes
    setTimeout(() => {
      if (interval) {
        stopMonitoring();
        if (paymentTab && !paymentTab.closed) {
          paymentTab.close();
        }
        setError('Payment monitoring timed out. Please check your payment status.');
      }
    }, 10 * 60 * 1000);
  };

  const checkPaymentStatus = async (paymentIntentId: string) => {
    try {
      // First check our database
      const { data: payment, error } = await supabase
        .from('payments')
        .select('status')
        .eq('payment_intent_id', paymentIntentId)
        .single();

      if (!error && payment?.status === 'completed') {
        await handlePaymentSuccess(paymentIntentId);
        return true;
      }

      // If not completed in our database, check with Ziina
      const paymentIntent = await verifyPaymentStatus(paymentIntentId);
      
      if (paymentIntent.status === 'completed') {
        // Update our database
        await supabase
          .from('payments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('payment_intent_id', paymentIntentId);
        
        // Enroll user
        await handlePaymentSuccess(paymentIntentId);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking payment status:', error);
      return false;
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
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
      if (paymentTab && !paymentTab.closed) {
        paymentTab.close();
      }
      
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
  };

  const handleClose = () => {
    if (paymentTab && !paymentTab.closed) {
      paymentTab.close();
    }
    stopMonitoring();
    setPaymentLink(null);
    setPaymentIntentId(null);
    setError(null);
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

        {/* Test Mode Indicator */}
        {!loadingSettings && (
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className={`p-3 rounded-lg border ${
              testMode 
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            }`}>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  testMode ? 'bg-blue-500' : 'bg-green-500'
                }`}></div>
                <span className={`text-sm font-medium ${
                  testMode 
                    ? 'text-blue-800 dark:text-blue-200' 
                    : 'text-green-800 dark:text-green-200'
                }`}>
                  {testMode ? 'Test Mode Active' : 'Live Payment Mode'}
                </span>
              </div>
              <p className={`text-xs mt-1 ${
                testMode 
                  ? 'text-blue-600 dark:text-blue-300' 
                  : 'text-green-600 dark:text-green-300'
              }`}>
                {testMode 
                  ? 'No real charges will be made. Use test card: 4242 4242 4242 4242'
                  : 'Real payment will be processed using your payment method'
                }
              </p>
            </div>
          </div>
        )}

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

        {/* Payment Monitoring Status */}
        {monitoring && (
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400 mr-3"></div>
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Monitoring Payment Status
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                    Complete your payment in the new tab. We'll automatically enroll you once payment is confirmed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Link Ready */}
        {paymentLink && !monitoring && (
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 mr-3" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                    Payment Link Ready
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                    Click the button below to open the secure payment page in a new tab. 
                    Complete your payment there and you'll be automatically enrolled in the course.
                  </p>
                  <button
                    onClick={handleOpenPayment}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Payment Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Button or Instructions */}
        <div className="p-6">
          {!paymentLink ? (
            <button
              onClick={handleCreatePayment}
              disabled={processing || loadingSettings}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating Payment Link...
                </>
              ) : loadingSettings ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Loading Settings...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Create Payment Link
                </>
              )}
            </button>
          ) : monitoring ? (
            <div className="space-y-3">
              <button
                onClick={handleOpenPayment}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center justify-center"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Reopen Payment Page
              </button>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Keep this window open while completing your payment
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleOpenPayment}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center justify-center"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Open Payment Page
              </button>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                After completing payment, return here or check your course enrollment in "My Courses"
              </p>
            </div>
          )}
          
          {!paymentLink && !loadingSettings && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
              We'll create a secure payment link that opens in a new tab to avoid popup blockers
            </p>
          )}
        </div>
      </div>
    </div>
  );
}