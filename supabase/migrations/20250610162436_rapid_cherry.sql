/*
  # Add course_type column to courses table

  1. Changes
    - Add `course_type` column to `courses` table with default value 'free'
    - Add `price` column for paid courses (stored as smallest currency unit)
    - Add `currency` column for paid courses
    - Update existing courses to have 'free' as default course type

  2. Security
    - No RLS changes needed as courses table should already have appropriate policies
*/

-- Add course_type column with default value 'free'
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS course_type text NOT NULL DEFAULT 'free';

-- Add price column for paid courses (stored in smallest currency unit, e.g., cents/fils)
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS price integer;

-- Add currency column for paid courses
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS currency text;

-- Add check constraint to ensure course_type is either 'free' or 'paid'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'courses_course_type_check'
  ) THEN
    ALTER TABLE public.courses 
    ADD CONSTRAINT courses_course_type_check 
    CHECK (course_type IN ('free', 'paid'));
  END IF;
END $$;

-- Add check constraint to ensure paid courses have price and currency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'courses_paid_course_check'
  ) THEN
    ALTER TABLE public.courses 
    ADD CONSTRAINT courses_paid_course_check 
    CHECK (
      (course_type = 'free') OR 
      (course_type = 'paid' AND price IS NOT NULL AND price > 0 AND currency IS NOT NULL)
    );
  END IF;
END $$;

-- Update any existing courses to have 'free' as course_type (this is already the default)
UPDATE public.courses 
SET course_type = 'free' 
WHERE course_type IS NULL;