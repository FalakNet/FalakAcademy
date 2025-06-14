import React, { useState } from 'react';
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
  const [monitoring, setMonitoring] = useState(false);

  if (!isOpen || !course.price || !course.currency) return null;

  const handlePayment = async () => {
    if (!profile) {
      setError('You must be logged in to make a purchase');
      return;
    }
    setProcessing(true);
    setError(null);
    // Open popup synchronously to avoid iOS popup blocking
    const popup = window.open('', 'ziina_payment', 'width=480,height=700');
    if (!popup) {
      setError('Popup blocked. Please allow popups and try again.');
      setProcessing(false);
      return;
    }
    try {
      const baseUrl = window.location.origin;
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
          status: 'pending',
        });
      if (paymentError) {
        console.error('Error creating payment record:', paymentError);
      }
      // Set popup location to payment URL
      popup.location.href = paymentIntent.redirect_url;
      setMonitoring(true);
      const poll = setInterval(async () => {
        try {
          const status = await verifyPaymentStatus(paymentIntent.id);
          if (status.status === 'completed') {
            await supabase
              .from('enrollments')
              .insert({
                user_id: profile.id,
                course_id: course.id
              });
            clearInterval(poll);
            popup.close();
            setMonitoring(false);
            onPaymentSuccess();
            onClose();
          } else if (status.status === 'failed' || status.status === 'canceled') {
            clearInterval(poll);
            popup.close();
            setMonitoring(false);
            setError('Payment was not completed. Please try again.');
          }
        } catch (e) {
          // ignore network errors, keep polling
        }
        if (popup.closed) {
          clearInterval(poll);
          setMonitoring(false);
        }
      }, 2000);
    } catch (error) {
      popup.close();
      console.error('Payment creation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to create payment');
    } finally {
      setProcessing(false);
    }
  };

  const currencyInfo = getSupportedCurrencies().find(c => c.code === course.currency);
  const formattedPrice = formatCurrency(course.price, course.currency);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto transform transition-all">
        {/* Header */}
        <div className="relative p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center pr-12">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Complete Purchase</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Secure payment powered by Ziina</p>
            </div>
          </div>
        </div>
        {/* Course Info */}
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-base sm:text-lg">{course.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
              {course.description || 'Premium course content with lifetime access'}
            </p>
          </div>
        </div>
        {/* Price Breakdown */}
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Course Price</span>
              <span className="font-semibold text-gray-900 dark:text-white text-lg">{formattedPrice}</span>
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
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{formattedPrice}</span>
              </div>
            </div>
          </div>
        </div>
        {/* Security Features */}
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="flex items-center">
              <Shield className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Secure Payment</span>
            </div>
            <div className="flex items-center">
              <Clock className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Instant Access</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="w-4 h-4 text-purple-500 mr-2 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Lifetime Access</span>
            </div>
            <div className="flex items-center">
              <CreditCard className="w-4 h-4 text-orange-500 mr-2 flex-shrink-0" />
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">All Cards</span>
            </div>
          </div>
        </div>
        {/* Error Message */}
        {error && (
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-start">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          </div>
        )}
        {/* Payment Button */}
        <div className="p-4 sm:p-6">
          <button
            onClick={handlePayment}
            disabled={processing || monitoring}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center touch-manipulation min-h-[56px]"
          >
            {processing || monitoring ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                <span className="text-sm sm:text-base">Processing...</span>
              </>
            ) : (
              <>
                <ExternalLink className="w-5 h-5 mr-2" />
                <span className="text-sm sm:text-base">Pay {formattedPrice}</span>
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3 leading-relaxed">
            Payment will open in a popup. Complete your payment to access the course.
          </p>
        </div>
      </div>
    </div>
  );
}