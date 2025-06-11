import React, { useState } from 'react';
import { X, CreditCard, Shield, Clock, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Course } from '../lib/supabase';
import { createPaymentIntent, formatCurrency, getSupportedCurrencies } from '../lib/ziina';
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
  const [testMode, setTestMode] = useState(import.meta.env.DEV || false);

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
      window.open(paymentLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleClose = () => {
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

        {/* Test Mode Toggle */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="test_mode"
                type="checkbox"
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="test_mode" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Test Mode {testMode ? '(On)' : '(Off)'}
              </label>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {testMode ? 'No real charges will be made' : 'Real payment will be processed'}
            </div>
          </div>
          
          {testMode && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Test Card:</strong> Use card number 4242 4242 4242 4242, any future expiry date, and any CVV.
              </p>
            </div>
          )}
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

        {/* Payment Link Ready */}
        {paymentLink && (
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
              disabled={processing}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating Payment Link...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Create Payment Link
                </>
              )}
            </button>
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
          
          {!paymentLink && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
              We'll create a secure payment link that opens in a new tab to avoid popup blockers
            </p>
          )}
        </div>
      </div>
    </div>
  );
}