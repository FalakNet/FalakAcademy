/*
  # Fix course price constraint to allow zero prices

  1. Changes
    - Drop the existing `courses_paid_course_check` constraint
    - Add new constraint that allows price >= 0 for paid courses
    - This allows free paid courses (price = 0) while still requiring currency for paid courses

  2. Security
    - No RLS changes needed as this only modifies check constraints
*/

-- Drop the existing constraint that requires price > 0
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'courses_paid_course_check'
  ) THEN
    ALTER TABLE public.courses 
    DROP CONSTRAINT courses_paid_course_check;
  END IF;
END $$;

-- Add new constraint that allows price >= 0 for paid courses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'courses_paid_course_check_v2'
  ) THEN
    ALTER TABLE public.courses 
    ADD CONSTRAINT courses_paid_course_check_v2 
    CHECK (
      (course_type = 'free') OR 
      (course_type = 'paid' AND price IS NOT NULL AND price >= 0 AND currency IS NOT NULL)
    );
  END IF;
END $$;