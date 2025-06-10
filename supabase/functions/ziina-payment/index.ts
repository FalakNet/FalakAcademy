import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface CreatePaymentParams {
  amount: number;
  currency: string;
  success_url: string;
  cancel_url: string;
  test?: boolean;
}

interface PaymentIntentResponse {
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

const ZIINA_BASE_URL = 'https://api.ziina.com';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/functions/v1/ziina-payment', '');

    // Get API key from environment - try both ZIINA_API_KEY and VITE_ZIINA_API_KEY
    const apiKey = Deno.env.get('ZIINA_API_KEY') || Deno.env.get('VITE_ZIINA_API_KEY');
    if (!apiKey) {
      throw new Error('ZIINA_API_KEY environment variable is required');
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    if (path === '/create-payment-intent' && req.method === 'POST') {
      const params: CreatePaymentParams = await req.json();
      
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

      // Validate amount based on currency
      const threeDecimalCurrencies = ['BHD', 'KWD', 'OMR'];
      
      if (threeDecimalCurrencies.includes(params.currency.toUpperCase())) {
        if (params.amount < 10) {
          throw new Error(`Amount must be at least 10 fils for ${params.currency}`);
        }
        if (params.amount % 10 !== 0) {
          throw new Error(`Amount must be rounded to nearest 10 fils for ${params.currency}`);
        }
      } else {
        if (params.amount < 200) {
          throw new Error(`Amount must be at least 200 cents (2 ${params.currency}) for ${params.currency}`);
        }
      }

      // Create payment intent with Ziina API
      const response = await fetch(`${ZIINA_BASE_URL}/payment_intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency.toUpperCase(),
          success_url: params.success_url,
          cancel_url: params.cancel_url,
          test: params.test || true, // Default to test mode
        }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          // If we can't parse the error response, use the default message
        }
        
        throw new Error(`Ziina API Error: ${errorMessage}`);
      }

      const paymentIntent: PaymentIntentResponse = await response.json();

      return new Response(
        JSON.stringify(paymentIntent),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (path.startsWith('/verify-payment/') && req.method === 'GET') {
      const paymentIntentId = path.replace('/verify-payment/', '');
      
      if (!paymentIntentId) {
        throw new Error('Payment Intent ID is required');
      }

      const response = await fetch(`${ZIINA_BASE_URL}/payment_intent/${paymentIntentId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          // If we can't parse the error response, use the default message
        }
        
        throw new Error(`Ziina API Error: ${errorMessage}`);
      }

      const paymentIntent: PaymentIntentResponse = await response.json();

      return new Response(
        JSON.stringify(paymentIntent),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )

  } catch (error) {
    console.error('Ziina payment function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})