// Ziina Payment Gateway Integration
export interface CreatePaymentParams {
  amount: number;
  currency: string;
  success_url: string;
  cancel_url: string;
  test?: boolean;
}

export interface PaymentIntentResponse {
  id: string;
  amount: number;
  currency_code: string;
  status: 'requires_payment_instrument' | 'pending' | 'requires_user_action' | 'completed' | 'failed' | 'canceled';
  redirect_url: string;
  success_url: string;
  cancel_url: string;
  test?: boolean;
  created_at: string;
  completed_at?: string;
  latest_error?: {
    code: string;
    message: string;
  };
  account_id: string;
  tip_amount: number;
  fee_amount?: number;
  operation_id: string;
  message?: string;
  allow_tips?: boolean;
}

export interface ZiinaError {
  error: {
    code: string;
    message: string;
    param?: string;
  };
}

/**
 * Handle API response and errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // If we can't parse the error response, use the default message
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
}

/**
 * Validate payment amount based on currency
 */
function validateAmount(amount: number, currency: string): void {
  // Three-decimal currencies (amounts in smallest unit, e.g., fils for BHD)
  const threeDecimalCurrencies = ['BHD', 'KWD', 'OMR'];
  
  if (threeDecimalCurrencies.includes(currency.toUpperCase())) {
    // For three-decimal currencies, minimum is typically 10 fils
    if (amount < 10) {
      throw new Error(`Amount must be at least 10 fils for ${currency}`);
    }
    // Amount must be rounded to nearest 10 for three-decimal currencies
    if (amount % 10 !== 0) {
      throw new Error(`Amount must be rounded to nearest 10 fils for ${currency}`);
    }
  } else {
    // For two-decimal currencies, minimum is typically 200 cents (2 units)
    if (amount < 200) {
      throw new Error(`Amount must be at least 200 cents (2 ${currency}) for ${currency}`);
    }
  }
}

/**
 * Generate a unique operation ID for the payment
 */
function generateOperationId(): string {
  return crypto.randomUUID();
}

/**
 * Create a payment intent with Ziina directly
 */
export async function createPaymentIntent(params: CreatePaymentParams): Promise<PaymentIntentResponse> {
  try {
    // Validate inputs
    if (!params.amount || params.amount <= 0) {
      throw new Error('Amount must be a positive number');
    }
    
    if (!params.currency) {
      throw new Error('Currency is required');
    }
    
    if (!params.success_url) {
      throw new Error('Success URL is required');
    }
    
    if (!params.cancel_url) {
      throw new Error('Cancel URL is required');
    }
    
    // Check for API key
    const apiKey = import.meta.env.VITE_ZIINA_API_KEY;
    if (!apiKey) {
      throw new Error('ZIINA_API_KEY environment variable is required. Please add VITE_ZIINA_API_KEY to your .env file.');
    }
    
    // Validate amount for currency
    validateAmount(params.amount, params.currency);
    
    // Direct API call to Ziina
    const apiUrl = 'https://api-v2.ziina.com/api/payment_intent';
    
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const requestBody = {
      amount: params.amount,
      currency_code: params.currency.toUpperCase(),
      success_url: params.success_url,
      cancel_url: params.cancel_url,
      test: params.test === true, // Explicitly check for true
      transaction_source: 'directApi' as const,
      operation_id: generateOperationId(),
    };

    console.log('Creating payment with test mode:', params.test);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
    
    return handleResponse<PaymentIntentResponse>(response);
    
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Network error: Please check your internet connection');
    }
    throw error;
  }
}

/**
 * Verify payment status by payment intent ID directly from Ziina
 */
export async function verifyPaymentStatus(paymentIntentId: string): Promise<PaymentIntentResponse> {
  try {
    if (!paymentIntentId) {
      throw new Error('Payment Intent ID is required');
    }
    
    // Check for API key
    const apiKey = import.meta.env.VITE_ZIINA_API_KEY;
    if (!apiKey) {
      throw new Error('ZIINA_API_KEY environment variable is required. Please add VITE_ZIINA_API_KEY to your .env file.');
    }
    
    // Direct API call to Ziina
    const apiUrl = `https://api-v2.ziina.com/api/payment_intent/${paymentIntentId}`;
    
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
    });
    
    return handleResponse<PaymentIntentResponse>(response);
    
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Network error: Please check your internet connection');
    }
    throw error;
  }
}

/**
 * Format amount for display based on currency
 */
export function formatCurrency(amount: number, currency: string): string {
  const threeDecimalCurrencies = ['BHD', 'KWD', 'OMR'];
  const divisor = threeDecimalCurrencies.includes(currency.toUpperCase()) ? 1000 : 100;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: threeDecimalCurrencies.includes(currency.toUpperCase()) ? 3 : 2,
  }).format(amount / divisor);
}

/**
 * Convert display amount to payment amount (in smallest currency unit)
 */
export function convertToPaymentAmount(displayAmount: number, currency: string): number {
  const threeDecimalCurrencies = ['BHD', 'KWD', 'OMR'];
  const multiplier = threeDecimalCurrencies.includes(currency.toUpperCase()) ? 1000 : 100;
  
  const amount = Math.round(displayAmount * multiplier);
  
  // For three-decimal currencies, round to nearest 10
  if (threeDecimalCurrencies.includes(currency.toUpperCase())) {
    return Math.round(amount / 10) * 10;
  }
  
  return amount;
}

/**
 * Get supported currencies
 */
export function getSupportedCurrencies(): Array<{ code: string; name: string; symbol: string }> {
  return [
    { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س' },
    { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق' },
    { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
    { code: 'BHD', name: 'Bahraini Dinar', symbol: 'د.ب' },
    { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  ];
}