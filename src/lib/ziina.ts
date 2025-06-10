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
  currency: string;
  status: 'requires_payment_instrument' | 'pending' | 'requires_user_action' | 'completed' | 'failed';
  redirect_url: string;
  success_url: string;
  cancel_url: string;
  test: boolean;
  created_at: string;
  completed_at?: string;
  latest_error?: {
    code: string;
    message: string;
    type: string;
  };
}

export interface ZiinaError {
  error: {
    code: string;
    message: string;
    param?: string;
  };
}

const ZIINA_BASE_URL = 'https://api.ziina.com';

/**
 * Get Ziina API key from environment variables
 */
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_ZIINA_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_ZIINA_API_KEY environment variable is required');
  }
  return apiKey;
}

/**
 * Create headers for Ziina API requests
 */
function createHeaders(): HeadersInit {
  return {
    'Authorization': `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Handle API response and errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData: ZiinaError = await response.json();
      errorMessage = errorData.error.message || errorMessage;
    } catch {
      // If we can't parse the error response, use the default message
    }
    
    throw new Error(`Ziina API Error: ${errorMessage}`);
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
 * Create a payment intent with Ziina
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
    
    // Validate amount for currency
    validateAmount(params.amount, params.currency);
    
    const response = await fetch(`${ZIINA_BASE_URL}/payment_intent`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency.toUpperCase(),
        success_url: params.success_url,
        cancel_url: params.cancel_url,
        test: params.test || false,
      }),
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
 * Verify payment status by payment intent ID
 */
export async function verifyPaymentStatus(paymentIntentId: string): Promise<PaymentIntentResponse> {
  try {
    if (!paymentIntentId) {
      throw new Error('Payment Intent ID is required');
    }
    
    const response = await fetch(`${ZIINA_BASE_URL}/payment_intent/${paymentIntentId}`, {
      method: 'GET',
      headers: createHeaders(),
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