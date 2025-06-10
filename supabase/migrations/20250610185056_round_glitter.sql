/*
  # Create payments table for tracking course purchases

  1. New Tables
    - `payments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `course_id` (uuid, foreign key to courses)
      - `amount` (integer, amount in smallest currency unit)
      - `currency` (text, currency code)
      - `payment_intent_id` (text, Ziina payment intent ID)
      - `status` (enum, payment status)
      - `created_at` (timestamp)
      - `completed_at` (timestamp, nullable)
      - `error_message` (text, nullable)

  2. Security
    - Enable RLS on `payments` table
    - Add policies for users to read their own payments
    - Add policies for admins to read all payments
*/

-- Create payment status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
  END IF;
END $$;

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  currency text NOT NULL,
  payment_intent_id text NOT NULL UNIQUE,
  status payment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own payments"
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own payments"
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('COURSE_ADMIN', 'SUPERADMIN')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_course_id ON public.payments(course_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_intent_id ON public.payments(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);